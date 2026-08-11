import { resolveTemplateSource, prepareSandbox, buildRenderEnv, compileTemplate, handleContextStrictMode, createEnvLookups, TEMPLATE_FILE_EXTENSION_RE } from './render-pipeline.ts';
import { validateRender, validateTemplateSource } from './render-validation.ts';
import { withStreamDeadline, coerceChunk, guardSingleConsumer } from './render-stream-adapters.ts';
import { createFileSystemLoader } from '@nunjucks/loaders';
import { serializeErrorPayload } from './pipe-stream.ts';
import type { RenderConfig, RenderStreamResult } from './render-types.ts';
import { execute, executeStream, createFrame, isStreamErrorSentinel, type StreamErrorSentinel, type ExecuteConfig } from '@nunjucks/runtime';
import { withTimeout } from '@nunjucks/lib/async/timeout';
import { getCallerFrames } from './caller-file.ts';
import { ok, err, isErr, type Result } from '@nunjucks/lib';
import { injectWarningsScript, adjustColnoForNullValue } from '@nunjucks/error-formatter';
import type { TemplateWarning, TemplateError } from '@nunjucks/error-formatter';
import { wrapWithLog } from '../diagnostics/diagnostics.ts';
import { toHtmlMarker, buildSourceTrace } from '@nunjucks/error-renderer';
import type { GlobalConfig } from '../config/global.ts';
import { getDefaultConfig } from '../config/global.ts';
import { defaultFilterBundle } from '../filter-bundle.ts';

interface ExecutionContext {
  code: string;
  sandboxedCtx: Record<string, unknown>;
  warningsCollector: TemplateWarning[];
  templateName: string | null;
}

const setupRenderConfig = (options: Partial<GlobalConfig>): RenderConfig => {
  const defaults = getDefaultConfig(defaultFilterBundle);
  // WHY: filter-bundle values are typed as `unknown` (GlobalConfig.filters is a Readonly<Record<string, unknown>>), but every entry is genuinely a callable. The cast is scoped to this constructed value rather than the whole config, so the rest of the RenderConfig is checked structurally.
  const filters = {
    ...defaults.filters,
    ...(options.filters || {}),
  } as Record<string, (...args: unknown[]) => unknown>;

  if (options.dompurify) {
    const baseSanitize = filters.sanitize as ((str: unknown, config?: unknown) => unknown) | undefined;
    filters.sanitize = (str: unknown, config?: unknown): unknown => baseSanitize ? baseSanitize(str, config ?? options.dompurify) : undefined;
  }

  const contextStrictExplicitlySet = options.contextStrict !== undefined;
  const sandboxExplicitlySet = options.sandbox !== undefined;
  return {
    ...defaults,
    ...options,
    // WHY: GlobalConfig models "no blocked keys" as `null` (DEFAULT_CONFIG), while RenderConfig uses `undefined`; normalize here so the constructed config satisfies RenderConfig without a blind whole-object cast.
    blockedContextKeys: options.blockedContextKeys ?? defaults.blockedContextKeys ?? undefined,
    filters,
    globals: { ...defaults.globals, ...(options.globals || {}) },
    // WHY: when contextStrict or sandbox is explicitly set, scanContextValues must be disabled so handleContextStrictMode/sandbox handles dangerous values instead of validateRenderContext (which always errors and calls getters during scanning).
    scanContextValues: contextStrictExplicitlySet || sandboxExplicitlySet ? false : defaults.scanContextValues,
  };
};

const resolveTemplateName = (template: string, config: RenderConfig): string => {
  const looksLikeFile = TEMPLATE_FILE_EXTENSION_RE.test(template);
  if (config.templatePath) {
    return config.templatePath;
  }
  if (looksLikeFile) {
    return template;
  }
  return config.callerFile || 'inline';
};

const buildExecutionEnv = (config: RenderConfig) => config.env ?? {
  opts: {
    dev: config.dev ?? false,
    autoescape: config.autoescape ?? true,
    undefined: config.undefined ?? 'default',
  },
  ...createEnvLookups(config),
};

const executeCompiledTemplate = async (ctx: ExecutionContext, config: RenderConfig): Promise<string> => {
  const frame = createFrame();
  const env = buildExecutionEnv(config);
  const renderPromise = execute({ code: ctx.code, context: ctx.sandboxedCtx, frame, env, config: config as ExecuteConfig });

  if ((config.executionTimeout ?? 0) > 0) {
    return await withTimeout(renderPromise, config.executionTimeout ?? 0);
  }
  return await renderPromise;
};

interface InjectWarningsInput {
  result: string;
  warningsCollector: TemplateWarning[];
  dev: boolean | undefined;
}

const injectWarningsIfNeeded = ({ result, warningsCollector, dev }: InjectWarningsInput): string => {
  if (warningsCollector.length > 0 && dev) {
    return result + injectWarningsScript(warningsCollector, { dev: true, verbosity: 'medium' });
  }
  return result;
};

interface RenderOptions extends Partial<GlobalConfig> {
  context?: Record<string, unknown>;
  streamContentType?: 'html' | 'json' | 'text';
}

interface PreparedTemplate {
  readonly code: string;
  readonly sandboxedCtx: Record<string, unknown>;
  readonly warningsCollector: TemplateWarning[];
  readonly templateName: string;
  readonly resolvedConfig: RenderConfig;
  readonly templateSource: string;
  readonly context: Record<string, unknown>;
  readonly streamContentType: 'html' | 'json' | 'text';
}

// WHY: pass-1 pipeline — 6 ordered steps, each with a distinct error strategy:
//   1. Validate config + context → Result err (inline def → catalog merge)
//   2. Context strict mode → try/catch (throws for 'error' mode, caught here)
//   3. Resolve template source → try/catch (file I/O, enriched via wrapWithLog)
//   4. Validate template syntax → Result err (same pattern as step 1)
//   5. Compile to JS → isErr check (compile errors enriched via wrapWithLog)
//   6. Prepare sandbox + env → pure transform (no failure path)
// Step 2 runs BEFORE step 3 so dangerous context values are caught early without wasted file I/O.
const prepareRender = async (template: string, { context = {}, ...options }: RenderOptions = {}): Promise<Result<PreparedTemplate, TemplateError>> => {
  const baseConfig = setupRenderConfig(options);
  const callerFrames = baseConfig.callerFrames ?? getCallerFrames();
  const primaryCaller = callerFrames[0] ?? null;
  const config: RenderConfig = {
    ...baseConfig,
    callerFrames,
    // WHY: callerFile/callerLocation are the innermost caller (frame 0) for internal consumers that read callerFile directly (resolveTemplateName, diagnostics). Derived from the single stack capture above instead of capturing the stack again.
    callerFile: baseConfig.callerFile ?? primaryCaller?.fileName ?? 'unknown',
    callerLocation: baseConfig.callerLocation ?? primaryCaller,
  };

  const renderValidation = await validateRender(template, { config, context });
  if (isErr(renderValidation)) { return err(renderValidation.error); }

  // WHY: context strict mode must run before template resolution/compilation — if the context contains dangerous values (e.g. process, eval), there is no point reading files or compiling templates. handleContextStrictMode throws for 'error' mode; catch and convert to Result so render() never throws.
  let warningsCollector: TemplateWarning[];
  let safeContext: Record<string, unknown>;
  try {
    const strictResult = await handleContextStrictMode(context, config);
    warningsCollector = strictResult.warningsCollector;
    safeContext = strictResult.context;
  } catch (strictErr) {
    return err(strictErr as TemplateError);
  }

  // WHY: the factory always sets config.loader (closure-cached, isolated per factory). Internal render() callers
  // (core tests) leave it unset — derive an UNCACHED loader from views for them. No module-global cache: this is
  // the only loader-creation site outside the factory, so there is no hidden cross-instance sharing.
  const loader = config.loader ?? (config.views ? createFileSystemLoader(config.views) : null);
  let templateSource: string;
  let templatePath: string | null;
  try {
    ({ templateSource, templatePath } = await resolveTemplateSource({ template, loader, config }));
  } catch (resolveErr) {
    return err(await wrapWithLog(resolveErr, config, { template, renderContext: safeContext }));
  }
  const configWithPath: RenderConfig = templatePath ? { ...config, templatePath } : config;

  const sourceValidation = await validateTemplateSource(templateSource, { config: configWithPath, context: safeContext });
  if (isErr(sourceValidation)) { return err(sourceValidation.error); }

  const templateName = resolveTemplateName(template, configWithPath);

  const compileResult = compileTemplate({ templateSource, config: configWithPath, templateName });
  if (isErr(compileResult)) {
    return err(await wrapWithLog(compileResult.error, configWithPath, { template: templateSource, renderContext: safeContext }));
  }
  const { code } = compileResult.value;

  const sandboxedCtx = prepareSandbox(configWithPath, safeContext);
  const envOverride = buildRenderEnv(loader, configWithPath);
  const resolvedConfig: RenderConfig = envOverride ? { ...configWithPath, env: envOverride } : configWithPath;

  return ok({ code, sandboxedCtx, warningsCollector, templateName, resolvedConfig, templateSource, context: safeContext, streamContentType: options.streamContentType ?? 'html' });
};

const render = async (template: string, options: RenderOptions = {}): Promise<Result<string, TemplateError>> => {
  const prepared = await prepareRender(template, options);
  if (isErr(prepared)) { return prepared; }

  const { code, sandboxedCtx, warningsCollector, templateName, resolvedConfig, templateSource, context } = prepared.value;
  let result: string;
  try {
    result = await executeCompiledTemplate({ code, sandboxedCtx, warningsCollector, templateName }, resolvedConfig);
  } catch (executeErr) {
    return err(await wrapWithLog(executeErr, resolvedConfig, { template: templateSource, renderContext: context }));
  }
  return ok(injectWarningsIfNeeded({ result, warningsCollector, dev: resolvedConfig.dev }));
};

// WHY: shared inline error marker formatter — used by formatStreamSentinel (sentinel path) and pipe-stream.ts renderMidStreamError (throw path). Single implementation for source trace extraction + toHtmlMarker formatting. adjustColnoForNullValue shifts the caret from the property (.get) to the parent variable (myContainer) for NULL_VALUE errors so the root cause is highlighted. contentType controls output format: html → inline marker + overlay, json → structured error object, text → plain text line.
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

// WHY: per-render enrichment cache for the Tier-2 (inline-marker) path. The first sentinel does full I/O (resolveLocation reads caller source files). Subsequent sentinels reuse the resolved location data (sourceContent, templatePath, sourceStartLine) and skip frame walking — eliminates N redundant file reads for N errors in the same render. Asymmetry with Tier 3 (the catch below) is intentional: Tier 2 may emit MANY sentinels (cache pays off), while Tier 3 is a SINGLE fatal throw that ends the stream (cache would never be reused), so the catch calls wrapWithLog directly without caching. Returns the enriched TemplateError; createRenderStream does the contentType-aware formatting so the JSON-fatal decision stays at the consumption point.
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

interface SentinelChunkInput {
  sentinel: StreamErrorSentinel;
  streamContentType: 'html' | 'json' | 'text';
  enrichSentinel: (sentinel: StreamErrorSentinel) => Promise<TemplateError>;
}

// WHY: decide a sentinel's fate by content type. json → fatal throw (an inline marker fragment after a JSON prefix is unparseable, so abort to the Tier 3 path); html/text → enriched inline marker string. The raw Layer-1 error is thrown for json so the caller's catch enriches it ONCE via wrapWithLog (no double-enrichment — enrichSentinel is skipped).
const formatSentinelChunk = async ({ sentinel, streamContentType, enrichSentinel }: SentinelChunkInput): Promise<string> => {
  if (streamContentType === 'json') {
    throw sentinel.error;
  }
  const enriched = await enrichSentinel(sentinel);
  return formatErrorMarker(enriched, { contentType: streamContentType });
};

// WHY: createRenderStream is the pass-2 streaming generator. try/catch/finally guarantees the underlying
// executeStream generator is returned on ANY termination — consumer abort, the timeout wrapper's .return(),
// normal completion, or a re-thrown fatal error. Without the finally, the inner generator (and any in-flight
// async filter / {% include %} / DB call inside a filter) would keep running as a zombie after the consumer
// stops iterating.
const createRenderStream = async function* (prepared: PreparedTemplate): AsyncGenerator<string> {
  const { code, sandboxedCtx, warningsCollector, resolvedConfig, templateSource, context } = prepared;
  const frame = createFrame();
  const env = buildExecutionEnv(resolvedConfig);
  const rootGenerator = executeStream({ code, context: sandboxedCtx, frame, env, config: resolvedConfig as ExecuteConfig });
  // WHY: executionTimeout is the TOTAL wall-clock deadline for streaming (same knob as blocking render). When set, withStreamDeadline races every chunk against a single timer and throws a code='TIMEOUT' (Tier 3 fatal) error on expiry. When unset (0), the generator runs unbounded by total time (the consumer's idle timeoutMs is still applicable via pipeRenderStream).
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
        yield coerceChunk(value);
      }
    }
  } catch (streamErr) {
    // WHY: enrich fatal mid-stream errors (non-output failures that bypass per-expression try/catch, plus json-fatal sentinels from formatSentinelChunk) via wrapWithLog so they carry the same full classification, source-trace, location, causes, and fix as blocking render errors.
    throw await wrapWithLog(streamErr, resolvedConfig, { template: templateSource, renderContext: context });
  } finally {
    // WHY: cascade cleanup to executeStream on early termination (abort/timeout/break) — best-effort, not awaited, since a stalled generator's .return() may never settle. On normal completion the generator is already done and .return() is a no-op.
    generator.return(undefined).catch(() => { /* best-effort: swallow cleanup rejection */ });
  }
  if (warningsCollector.length > 0 && resolvedConfig.dev) {
    yield injectWarningsScript(warningsCollector, { dev: true, verbosity: 'medium' });
  }
};

// WHY: two-pass streaming (Option B). Pass-1 (prepareRender) validates/compiles — a failure here is returned as { ok: false, error } so the consumer can still render an error page (response headers not yet sent). On success, pass-2 returns the async generator directly (no drain); mid-stream runtime errors then surface as a generator throw after chunks have already been emitted. Pass streamErrorRecovery: true in options to enable per-expression error recovery (inline markers instead of stream termination). Pass streamContentType: 'json' to make mid-stream sentinels fatal (JSON cannot absorb inline markers without corrupting the response).
const renderToStream = async (template: string, options: RenderOptions = {}): Promise<RenderStreamResult> => {
  const prepared = await prepareRender(template, options);
  if (isErr(prepared)) { return { ok: false, error: prepared.error }; }
  return { ok: true, stream: guardSingleConsumer(createRenderStream(prepared.value)) };
};

export { render, renderToStream, formatErrorMarker };
export type { RenderConfig, RenderOptions, RenderStreamResult };
