import { resolveTemplateSource, prepareSandbox, buildRenderEnv, buildExecutionEnv, compileTemplate, handleContextStrictMode, TEMPLATE_FILE_EXTENSION_RE } from './render-pipeline.ts';
import { validateRender, validateTemplateSource } from './render-validation.ts';
import { guardSingleConsumer } from './render-stream-adapters.ts';
import { createFileSystemLoader } from '@nunjucks/loaders';
import type { RenderConfig, RenderStreamResult, PreparedTemplate, RenderOptions } from './render-types.ts';
import { execute, createFrame, type ExecuteConfig } from '@nunjucks/runtime';
import { withTimeout } from '@nunjucks/lib/async/timeout';
import { getCallerFrames } from './caller-file.ts';
import { ok, err, isErr, type Result } from '@nunjucks/lib';
import { injectWarningsScript } from '@nunjucks/error-renderer';
import type { TemplateWarning, TemplateError } from '@nunjucks/error-formatter';
import { wrapWithLog } from '../diagnostics/diagnostics.ts';
import { getDefaultConfig } from '../config/global.ts';
import { defaultFilterBundle } from '../filter-bundle.ts';
import { createRenderStream, formatErrorMarker } from './render-stream.ts';

const setupRenderConfig = (options: Partial<import('../config/global.ts').GlobalConfig>): RenderConfig => {
  const defaults = getDefaultConfig(defaultFilterBundle);
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
    blockedContextKeys: options.blockedContextKeys ?? defaults.blockedContextKeys ?? undefined,
    filters,
    globals: { ...defaults.globals, ...(options.globals || {}) },
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

const executeCompiledTemplate = async (ctx: { code: string; sandboxedCtx: Record<string, unknown>; warningsCollector: TemplateWarning[]; templateName: string | null }, config: RenderConfig): Promise<string> => {
  const frame = createFrame();
  const env = config.env ?? buildExecutionEnv(config);
  const renderPromise = execute({ code: ctx.code, context: ctx.sandboxedCtx, frame, env, config: config as ExecuteConfig });

  if ((config.executionTimeout ?? 0) > 0) {
    return await withTimeout(renderPromise, config.executionTimeout ?? 0);
  }
  return await renderPromise;
};

const injectWarningsIfNeeded = ({ result, warningsCollector, dev }: { result: string; warningsCollector: TemplateWarning[]; dev: boolean | undefined }): string => {
  if (warningsCollector.length > 0 && dev) {
    return result + injectWarningsScript(warningsCollector, { dev: true, verbosity: 'medium' });
  }
  return result;
};

const prepareRender = async (template: string, { context = {}, ...options }: RenderOptions = {}): Promise<Result<PreparedTemplate, TemplateError>> => {
  const baseConfig = setupRenderConfig(options);
  const callerFrames = baseConfig.callerFrames ?? getCallerFrames();
  const primaryCaller = callerFrames[0] ?? null;
  const config: RenderConfig = {
    ...baseConfig,
    callerFrames,
    callerFile: baseConfig.callerFile ?? primaryCaller?.fileName ?? 'unknown',
    callerLocation: baseConfig.callerLocation ?? primaryCaller,
  };

  const renderValidation = await validateRender(template, { config, context });
  if (isErr(renderValidation)) { return err(renderValidation.error); }

  let warningsCollector: TemplateWarning[];
  let safeContext: Record<string, unknown>;
  try {
    const strictResult = await handleContextStrictMode(context, config);
    warningsCollector = strictResult.warningsCollector;
    safeContext = strictResult.context;
  } catch (strictErr: unknown) {
    return err(strictErr as TemplateError);
  }

  const loader = config.loader ?? (config.views ? createFileSystemLoader(config.views) : null);
  let templateSource: string;
  let templatePath: string | null;
  try {
    ({ templateSource, templatePath } = await resolveTemplateSource({ template, loader, config }));
  } catch (resolveErr: unknown) {
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

  return ok({ code, sandboxedCtx, warningsCollector, templateName, resolvedConfig, templateSource, context: safeContext, streamContentType: options.streamContentType ?? 'html', version: resolvedConfig.version });
};

const render = async (template: string, options: RenderOptions = {}): Promise<Result<string, TemplateError>> => {
  const prepared = await prepareRender(template, options);
  if (isErr(prepared)) { return prepared; }

  const { code, sandboxedCtx, warningsCollector, templateName, resolvedConfig, templateSource, context } = prepared.value;
  let result: string;
  try {
    result = await executeCompiledTemplate({ code, sandboxedCtx, warningsCollector, templateName }, resolvedConfig);
  } catch (executeErr: unknown) {
    return err(await wrapWithLog(executeErr, resolvedConfig, { template: templateSource, renderContext: context }));
  }
  return ok(injectWarningsIfNeeded({ result, warningsCollector, dev: resolvedConfig.dev }));
};

const renderToStream = async (template: string, options: RenderOptions = {}): Promise<RenderStreamResult> => {
  const prepared = await prepareRender(template, options);
  if (isErr(prepared)) { return { ok: false, error: prepared.error }; }
  return { ok: true, stream: guardSingleConsumer(createRenderStream(prepared.value)) };
};

export { render, renderToStream, formatErrorMarker };
export type { RenderConfig, RenderOptions, RenderStreamResult };
