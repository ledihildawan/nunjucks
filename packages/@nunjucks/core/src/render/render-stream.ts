import { buildExecutionEnv } from './render-pipeline.ts';
import { withStreamDeadline, coerceChunk } from './render-stream-adapters.ts';
import { executeStream, createFrame, isStreamErrorSentinel, type StreamErrorSentinel, type ExecuteConfig } from '@nunjucks/runtime';
import { isErr } from '@nunjucks/lib';
import { injectWarningsScript } from '@nunjucks/error-renderer';
import { adjustColnoForNullValue } from '@nunjucks/error-formatter';
import { wrapWithLog } from '../diagnostics/diagnostics.ts';
import { toHtmlMarker, buildSourceTrace } from '@nunjucks/error-renderer';
import { serializeErrorPayload } from './pipe-stream.ts';
import type { PreparedTemplate } from './render-types.ts';
import type { TemplateError } from '@nunjucks/error-formatter';

interface SentinelChunkInput {
  sentinel: StreamErrorSentinel;
  streamContentType: 'html' | 'json' | 'text';
  enrichSentinel: (sentinel: StreamErrorSentinel) => Promise<TemplateError>;
}

const createCachedEnrichment = (prepared: PreparedTemplate) => {
  let locationCache: { sourceContent: string | null; templatePath: string | null; sourceStartLine: number; lineBase: string } | null = null;

  return async (sentinel: StreamErrorSentinel): Promise<TemplateError> => {
    if (!locationCache) {
      const enriched = await wrapWithLog(sentinel.error, prepared.resolvedConfig, { template: prepared.templateSource, renderContext: prepared.context });
      locationCache = {
        sourceContent: enriched.sourceContent ?? null,
        templatePath: enriched.templatePath ?? null,
        sourceStartLine: enriched.sourceStartLine ?? 1,
        lineBase: enriched.lineBase ?? 'zero',
      };
      return enriched;
    }
    const enriched = await wrapWithLog(
      sentinel.error,
      { ...prepared.resolvedConfig, callerFrames: null, callerLocation: null, jsCaller: null },
      { template: prepared.templateSource, renderContext: prepared.context },
    );
    return {
      ...enriched,
      sourceContent: locationCache.sourceContent ?? undefined,
      templatePath: locationCache.templatePath ?? enriched.templatePath,
      sourceStartLine: locationCache.sourceStartLine,
    };
  };
};

const formatSentinelChunk = async ({ sentinel, streamContentType, enrichSentinel }: SentinelChunkInput): Promise<string> => {
  if (streamContentType === 'json') {
    throw sentinel.error;
  }
  const enriched = await enrichSentinel(sentinel);
  const trace = buildSourceTrace({
    sourceContent: enriched.sourceContent ?? null,
    templatePath: enriched.templatePath ?? enriched.templateName ?? null,
    lineno: enriched.lineno,
    colno: adjustColnoForNullValue(enriched),
    lineBase: enriched.lineBase ?? 'zero',
    sourceStartLine: enriched.sourceStartLine ?? 1,
    blockedKeys: enriched.blockedKeys ?? null,
  });
  return toHtmlMarker(enriched, { sourceTrace: trace, ide: 'vscode' });
};

const formatErrorMarker = (error: TemplateError, options: { ide?: string; contentType?: string } = {}): string => {
  const { ide = 'vscode', contentType = 'html' } = options;
  if (contentType === 'json') {
    return `\n${serializeErrorPayload(error)}`;
  }
  if (contentType === 'text') {
    return `\n[render error] ${error.message} at ${error.templatePath ?? 'unknown'}:${error.lineno ?? '?'}:${error.colno ?? '?'}`;
  }
  const trace = buildSourceTrace({
    sourceContent: error.sourceContent ?? null,
    templatePath: error.templatePath ?? error.templateName ?? null,
    lineno: error.lineno,
    colno: adjustColnoForNullValue(error),
    lineBase: error.lineBase ?? 'zero',
    sourceStartLine: error.sourceStartLine ?? 1,
    blockedKeys: error.blockedKeys ?? null,
  });
  return toHtmlMarker(error, { sourceTrace: trace, ide });
};

const createRenderStream = async function* (prepared: PreparedTemplate): AsyncGenerator<string> {
  const { code, sandboxedCtx, warningsCollector, resolvedConfig, templateSource, context } = prepared;
  const frame = createFrame();
  const env = buildExecutionEnv(resolvedConfig);
  const rootGenerator = executeStream({ code, context: sandboxedCtx, frame, env, config: resolvedConfig as ExecuteConfig });
  const deadlineMs = resolvedConfig.executionTimeout ?? 0;
  const generator = deadlineMs > 0 ? withStreamDeadline(rootGenerator, deadlineMs) : rootGenerator;
  const enrichSentinel = createCachedEnrichment(prepared);
  try {
    while (true) {
      const { value, done } = await generator.next();
      if (done) { break; }
      if (isStreamErrorSentinel(value)) {
        yield await formatSentinelChunk({ sentinel: value, streamContentType: prepared.streamContentType, enrichSentinel });
      } else {
        const chunkResult = coerceChunk(value);
        if (isErr(chunkResult)) { throw chunkResult.error; }
        yield chunkResult.value;
      }
    }
  } catch (streamErr: unknown) {
    throw await wrapWithLog(streamErr, resolvedConfig, { template: templateSource, renderContext: context });
  } finally {
    generator.return(undefined).catch(() => { /* best-effort: swallow cleanup rejection */ });
  }
  if (warningsCollector.length > 0 && resolvedConfig.dev) {
    yield injectWarningsScript(warningsCollector, { dev: true, verbosity: 'medium' });
  }
};

export { createRenderStream, formatErrorMarker };
