import type { TemplateError } from '@nunjucks/error-formatter';
import { adjustColnoForNullValue } from '@nunjucks/error-formatter';
import type { LineBase } from '@nunjucks/error-catalog';
import {
  buildSourceTrace,
  classifyAndBuildTitle,
  DEFAULT_IDE,
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
import type { ContentType } from '@nunjucks/shared';
import { wrapWithLog } from '../diagnostics/diagnostics.ts';
import { serializeErrorPayload } from './pipe-stream.ts';
import { buildExecutionEnv } from './render-env.ts';
import {
  coerceChunk,
  createStreamTimeoutError,
  withStreamDeadline,
} from './render-stream-adapters.ts';
import type { PreparedTemplate, RenderMarkerError } from './render-types.ts';
import type { DisplaySeverity } from './severity-levels.ts';
import { getSeverity } from './severity-levels.ts';

interface SentinelChunkInput {
  sentinel: StreamErrorSentinel;
  streamContentType: ContentType;
  enrichSentinel: (sentinel: StreamErrorSentinel) => Promise<TemplateError>;
  version?: string;
  dev: boolean;
}

const createCachedEnrichment = (prepared: PreparedTemplate) => {
  let locationCache: {
    sourceContent: string | null;
    templatePath: string | null;
    sourceStartLine: number;
    lineBase: LineBase;
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
    // WHY: the cache holds the FIRST sentinel's caller-file coordinates (lineBase
    // 'one' + caller sourceContent); later sentinels resolve template coordinates
    // ('zero' + template-relative lineno). Merging caller content with template
    // coordinates misaligns every trace after the first — lineBase must come from
    // the same cache entry as the sourceContent it will be rendered against.
    return {
      ...enriched,
      sourceContent: locationCache.sourceContent ?? enriched.sourceContent,
      templatePath: locationCache.templatePath ?? enriched.templatePath,
      sourceStartLine: locationCache.sourceStartLine,
      lineBase: locationCache.lineBase,
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
  const severity: DisplaySeverity = getSeverity(enriched);
  const humanTitle = classifyAndBuildTitle(enriched);
  return toHtmlMarker(enriched, {
    sourceTrace: trace,
    ide: DEFAULT_IDE,
    severity,
    humanTitle,
    version,
    // WHY: dev gates the marker's embedded iframe page — without it toHtml's safe default
    // renders the production minimal page, keeping stacks/PII out of streamed responses.
    dev,
  });
};

/** Formats a mid-stream error as an inline marker — JSON, text, or HTML by content type. */
const formatErrorMarker = (
  error: RenderMarkerError,
  options: { ide?: string; contentType?: string; version?: string; dev?: boolean } = {}
): string => {
  const { ide = DEFAULT_IDE, contentType = 'html', version, dev } = options;
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
  return toHtmlMarker(error, {
    sourceTrace: trace,
    ide,
    severity: 'block',
    humanTitle,
    version,
    dev,
  });
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

/**
 * Streams a prepared template's output — sentinel errors render as inline
 * markers (enriched once, then location-cached), thrown errors surface as
 * enriched `TemplateError`s, and a cooperative deadline bounds CPU-bound chains.
 */
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
    config: {
      ...(resolvedConfig as ExecuteConfig),
      // WHY: same diagnostics wiring as the non-streaming execute call — logContext +
      // warnings slot so sentinel/undefined warnings reach this stream's collector.
      templateName: prepared.templateName,
      renderContext: sandboxedCtx,
      warningsCollector,
    },
  });
  const deadlineMs = resolvedConfig.executionTimeout ?? 0;
  const generator = deadlineMs > 0 ? withStreamDeadline(rootGenerator, deadlineMs) : rootGenerator;
  // WHY: cooperative deadline — withStreamDeadline's setTimeout can NEVER fire for a
  // microtask-only chunk chain (macrotask starvation), so a CPU-bound stream ignored
  // the limit entirely. Mirrors the blocking path's chunk-boundary Date.now() check
  // (runtime/src/executor.ts); a never-yielding render still cannot be preempted.
  const deadlineAt = deadlineMs > 0 ? Date.now() + deadlineMs : Number.POSITIVE_INFINITY;
  const enrichSentinel = createCachedEnrichment(prepared);
  try {
    // WHY: while(true) drain — async time-based stream processing exemption (§3);
    // exit is the generator's `done` or a thrown sentinel, not a loop condition.
    while (true) {
      const { value, done } = await generator.next();
      if (Date.now() > deadlineAt) {
        throw createStreamTimeoutError(deadlineMs, 'deadline');
      }
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
      // intentional no-op — best-effort cleanup rejection during stream abort
    });
  }
  if (warningsCollector.length > 0 && resolvedConfig.dev) {
    yield injectWarningsScript(warningsCollector, { dev: true, verbosity: 'medium' });
  }
};

export { createRenderStream, formatErrorMarker };
