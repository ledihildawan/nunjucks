import { resolveTemplateSource, prepareSandbox, buildRenderEnv, compileTemplate, handleContextStrictMode, createEnvLookups, TEMPLATE_FILE_EXTENSION_RE } from './render-pipeline.ts';
import { validateRender, validateTemplateSource } from './render-validation.ts';
import { getLoader } from '../engine.ts';
import type { RenderConfig, RenderStreamResult } from './render-types.ts';
import { execute, executeStream, createFrame, withTimeout, isStreamErrorSentinel, type StreamErrorSentinel } from '@nunjucks/runtime';
import { getCallerFrames } from './caller-file.ts';
import { ok, err, isErr, type Result } from '@nunjucks/shared';
import { injectWarningsScript, type TemplateWarning, type TemplateError } from '@nunjucks/log';
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
    const dompurifyConfig = options.dompurify;
    filters.sanitize = (str: unknown, config?: unknown): unknown =>
      baseSanitize ? baseSanitize(str, config ?? dompurifyConfig) : undefined;
  }

  return {
    ...defaults,
    ...options,
    // WHY: GlobalConfig models "no blocked keys" as `null` (DEFAULT_CONFIG), while RenderConfig uses `undefined`; normalize here so the constructed config satisfies RenderConfig without a blind whole-object cast.
    blockedContextKeys: options.blockedContextKeys ?? defaults.blockedContextKeys ?? undefined,
    filters,
    globals: { ...defaults.globals, ...(options.globals || {}) },
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
  const renderPromise = execute(ctx.code, ctx.sandboxedCtx, frame, env, { ...config });

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
}

interface PreparedTemplate {
  readonly code: string;
  readonly sandboxedCtx: Record<string, unknown>;
  readonly warningsCollector: TemplateWarning[];
  readonly templateName: string;
  readonly resolvedConfig: RenderConfig;
  readonly templateSource: string;
  readonly context: Record<string, unknown>;
}

// WHY: pass-1 of rendering — validation, context-scrub, template resolution, compile, and sandbox/env preparation, with NO execution. Extracted so render() (buffer-execute) and renderToStream() (stream-execute) share identical pre-execution work and error enrichment. Context strict mode runs BEFORE template resolution/compilation so dangerous values are caught early without wasted I/O. Every failure here is a Result error the consumer can still render as an error page (response headers not yet sent).
const prepareRender = async (template: string, { context = {}, ...options }: RenderOptions = {}): Promise<Result<PreparedTemplate, TemplateError>> => {
  const baseConfig = setupRenderConfig(options);
  const callerFrames = baseConfig.callerFrames ?? getCallerFrames();
  const primaryCaller = callerFrames[0] ?? null;
  const config: RenderConfig = {
    ...baseConfig,
    callerFrames,
    // WHY: callerFile/callerLocation are the innermost caller (frame 0) for legacy consumers (resolveTemplateName, diagnostics). Derived from the single stack capture above instead of capturing the stack again.
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

  const loader = getLoader(config);
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

  return ok({ code, sandboxedCtx, warningsCollector, templateName, resolvedConfig, templateSource, context: safeContext });
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

// WHY: streaming counterpart of executeCompiledTemplate — yields the root generator's chunks instead of draining them. When streamErrorRecovery is enabled, per-expression errors arrive as StreamErrorSentinel values (not throws) — these are enriched via wrapWithLog and formatted as inline HTML markers so the stream continues past failures. Fatal errors (non-output, e.g. {% for %} loop failures) still propagate as throws.
const formatStreamSentinel = async (sentinel: StreamErrorSentinel, prepared: PreparedTemplate): Promise<string> => {
  const enriched = await wrapWithLog(sentinel.error, prepared.resolvedConfig, { template: prepared.templateSource, renderContext: prepared.context });
  const trace = buildSourceTrace({
    sourceContent: enriched.sourceContent ?? null,
    templatePath: enriched.templatePath ?? enriched.templateName ?? null,
    lineno: enriched.lineno,
    colno: enriched.colno,
    lineBase: enriched.lineBase ?? 'zero',
    sourceStartLine: enriched.sourceStartLine ?? 1,
  });
  return toHtmlMarker(enriched, { sourceTrace: trace, ide: 'vscode' });
};

const createRenderStream = async function* (prepared: PreparedTemplate): AsyncGenerator<string> {
  const { code, sandboxedCtx, warningsCollector, resolvedConfig, templateSource, context } = prepared;
  const frame = createFrame();
  const env = buildExecutionEnv(resolvedConfig);
  const generator = executeStream(code, sandboxedCtx, frame, env, resolvedConfig);
  try {
    while (true) {
      const { value, done } = await generator.next();
      if (done) { break; }
      if (isStreamErrorSentinel(value)) {
        yield await formatStreamSentinel(value, prepared);
      } else {
        yield value as string;
      }
    }
  } catch (streamErr) {
    // WHY: enrich fatal mid-stream errors (non-output failures that bypass per-expression try/catch) via wrapWithLog so they carry the same full classification, source-trace, location, causes, and fix as blocking render errors.
    throw await wrapWithLog(streamErr, resolvedConfig, { template: templateSource, renderContext: context });
  }
  if (warningsCollector.length > 0 && resolvedConfig.dev) {
    yield injectWarningsScript(warningsCollector, { dev: true, verbosity: 'medium' });
  }
};

// WHY: two-pass streaming (Option B). Pass-1 (prepareRender) validates/compiles — a failure here is returned as { ok: false, error } so the consumer can still render an error page (response headers not yet sent). On success, pass-2 returns the async generator directly (no drain); mid-stream runtime errors then surface as a generator throw after chunks have already been emitted. Pass streamErrorRecovery: true in options to enable per-expression error recovery (inline markers instead of stream termination).
const renderToStream = async (template: string, options: RenderOptions = {}): Promise<RenderStreamResult> => {
  const prepared = await prepareRender(template, options);
  if (isErr(prepared)) { return { ok: false, error: prepared.error }; }
  return { ok: true, stream: createRenderStream(prepared.value) };
};

export { render, renderToStream };
export type { RenderConfig, RenderOptions, RenderStreamResult };
