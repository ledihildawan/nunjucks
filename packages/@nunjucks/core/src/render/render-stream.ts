import type { TemplateError } from '@nunjucks/error-formatter';
import { adjustColnoForNullValue } from '@nunjucks/error-formatter';
import {
  buildSourceTrace,
  classifyAndBuildTitle,
  injectWarningsScript,
  toHtmlMarker,
} from '@nunjucks/error-renderer';
import { isErr } from '@nunjucks/lib';
import {
  createFrame,
  type ExecuteConfig,
  executeStream,
  isStreamErrorSentinel,
  type StreamErrorSentinel,
} from '@nunjucks/runtime';
import { wrapWithLog } from '../diagnostics/diagnostics.ts';
import { serializeErrorPayload } from './pipe-stream.ts';
import { buildExecutionEnv } from './render-env.ts';
import { coerceChunk, withStreamDeadline } from './render-stream-adapters.ts';
import type { PreparedTemplate } from './render-types.ts';
import type { ErrorSeverity } from './severity-levels.ts';
import { getSeverity } from './severity-levels.ts';

interface SentinelChunkInput {
  sentinel: StreamErrorSentinel;
  streamContentType: 'html' | 'json' | 'text';
  enrichSentinel: (sentinel: StreamErrorSentinel) => Promise<TemplateError>;
  version?: string;
  dev: boolean;
}

const createCachedEnrichment = (prepared: PreparedTemplate) => {
  let locationCache: {
    sourceContent: string | null;
    templatePath: string | null;
    sourceStartLine: number;
    lineBase: string;
  } | null = null;

  return async (sentinel: StreamErrorSentinel): Promise<TemplateError> => {
    if (!locationCache) {
      const enriched = await wrapWithLog({
        error: sentinel.error,
        config: prepared.resolvedConfig,
        template: prepared.templateSource,
        renderContext: prepared.context,
      });
      locationCache = {
        sourceContent: enriched.sourceContent ?? null,
        templatePath: enriched.templatePath ?? null,
        sourceStartLine: enriched.sourceStartLine ?? 1,
        lineBase: enriched.lineBase ?? 'zero',
      };
      return enriched;
    }
    const enriched = await wrapWithLog({
      error: sentinel.error,
      config: {
        ...prepared.resolvedConfig,
        callerFrames: null,
        callerLocation: null,
        jsCaller: null,
      },
      template: prepared.templateSource,
      renderContext: prepared.context,
    });
    return {
      ...enriched,
      sourceContent: locationCache.sourceContent ?? undefined,
      templatePath: locationCache.templatePath ?? enriched.templatePath,
      sourceStartLine: locationCache.sourceStartLine,
    };
  };
};

const formatSentinelChunk = async ({
  sentinel,
  streamContentType,
  enrichSentinel,
  version,
  dev,
}: SentinelChunkInput): Promise<string> => {
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
  const severity: ErrorSeverity = getSeverity(enriched);
  const humanTitle = classifyAndBuildTitle(enriched);
  return toHtmlMarker(enriched, {
    sourceTrace: trace,
    ide: 'vscode',
    severity,
    humanTitle,
    version,
    // WHY: dev gates the marker's embedded iframe page — without it toHtml's safe default
    // renders the production minimal page, keeping stacks/PII out of streamed responses.
    dev,
  });
};

const formatErrorMarker = (
  error: TemplateError,
  options: { ide?: string; contentType?: string; version?: string; dev?: boolean } = {}
): string => {
  const { ide = 'vscode', contentType = 'html', version, dev } = options;
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
  const humanTitle = classifyAndBuildTitle(error);
  return toHtmlMarker(error, { sourceTrace: trace, ide, severity: 'block', humanTitle, version, dev });
};

interface StreamChunkInput {
  value: unknown;
  prepared: PreparedTemplate;
  enrichSentinel: (sentinel: StreamErrorSentinel) => Promise<TemplateError>;
}

const formatStreamChunk = async ({
  value,
  prepared,
  enrichSentinel,
}: StreamChunkInput): Promise<string> => {
  if (isStreamErrorSentinel(value)) {
    return formatSentinelChunk({
      sentinel: value,
      streamContentType: prepared.streamContentType,
      enrichSentinel,
      version: prepared.version,
      dev: prepared.resolvedConfig.dev ?? false,
    });
  }
  const chunkResult = coerceChunk(value);
  if (isErr(chunkResult)) {
    throw chunkResult.error;
  }
  return chunkResult.value;
};

const createRenderStream = async function* (prepared: PreparedTemplate): AsyncGenerator<string> {
  const { code, sandboxedCtx, warningsCollector, resolvedConfig, templateSource, context } =
    prepared;
  const frame = createFrame();
  const env = buildExecutionEnv(resolvedConfig);
  const rootGenerator = executeStream({
    code,
    context: sandboxedCtx,
    frame,
    env,
    config: resolvedConfig as ExecuteConfig,
  });
  const deadlineMs = resolvedConfig.executionTimeout ?? 0;
  const generator = deadlineMs > 0 ? withStreamDeadline(rootGenerator, deadlineMs) : rootGenerator;
  const enrichSentinel = createCachedEnrichment(prepared);
  try {
    while (true) {
      const { value, done } = await generator.next();
      if (done) {
        break;
      }
      yield await formatStreamChunk({ value, prepared, enrichSentinel });
    }
  } catch (streamErr: unknown) {
    throw await wrapWithLog({
      error: streamErr,
      config: resolvedConfig,
      template: templateSource,
      renderContext: context,
    });
  } finally {
    generator.return(undefined).catch(() => {
      /* best-effort: swallow cleanup rejection */
    });
  }
  if (warningsCollector.length > 0 && resolvedConfig.dev) {
    yield injectWarningsScript(warningsCollector, { dev: true, verbosity: 'medium' });
  }
};

export { createRenderStream, formatErrorMarker };
