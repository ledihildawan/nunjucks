import { resolveTemplateSource, prepareSandbox, buildRenderEnv, compileTemplate, handleContextStrictMode, createEnvLookups, TEMPLATE_FILE_EXTENSION_RE } from './render-pipeline.ts';
import { validateRender, validateTemplateSource } from './render-validation.ts';
import { getLoader } from '../engine.ts';
import type { RenderConfig } from './render-types.ts';
import { execute, createFrame, withTimeout } from '@nunjucks/runtime';
import { getCallerFile, getCallerLocation, ok, err, isErr, type Result } from '@nunjucks/shared';
import { injectWarningsScript, wrapWithLog, type TemplateWarning, type TemplateError } from '@nunjucks/log';
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
  const filters = { ...defaults.filters, ...(options.filters || {}) };

  if (options.dompurify) {
    const baseSanitize = filters.sanitize as ((str: unknown, config?: unknown) => unknown) | undefined;
    const dompurifyConfig = options.dompurify;
    filters.sanitize = (str: unknown, config?: unknown): unknown =>
      baseSanitize ? baseSanitize(str, config ?? dompurifyConfig) : undefined;
  }

  return {
    ...defaults,
    ...options,
    filters,
    globals: { ...defaults.globals, ...(options.globals || {}) },
    extensions: { ...defaults.extensions, ...(options.extensions || {}) },
  } as RenderConfig;
};

const resolveTemplateName = (template: string, config: RenderConfig): string => {
  const looksLikeFile = TEMPLATE_FILE_EXTENSION_RE.test(template);
  if (config.templatePath) {
    return config.templatePath;
  }
  if (looksLikeFile) {
    return template;
  }
  return config._callerFile || 'inline';
};

const executeCompiledTemplate = async (ctx: ExecutionContext, config: RenderConfig): Promise<string> => {
  const frame = createFrame();
  const env = config.env ?? {
    opts: {
      dev: config.dev ?? false,
      autoescape: config.autoescape ?? true,
      undefined: config.undefined ?? 'default',
    },
    ...createEnvLookups(config),
  };
  const renderPromise = execute(ctx.code, ctx.sandboxedCtx, frame, env, { ...config });

  if ((config.executionTimeout ?? 0) > 0) {
    return await withTimeout(renderPromise, config.executionTimeout ?? 0);
  }
  return await renderPromise;
};

const injectWarningsIfNeeded = (result: string, warningsCollector: TemplateWarning[], dev: boolean | undefined): string => {
  if (warningsCollector.length > 0 && dev) {
    return result + injectWarningsScript(warningsCollector, { dev: true, verbosity: 'medium' });
  }
  return result;
};

const render = async (template: string, context: Record<string, unknown> = {}, options: Partial<GlobalConfig> = {}): Promise<Result<string, TemplateError>> => {
  const baseConfig = setupRenderConfig(options);
  const config: RenderConfig = {
    ...baseConfig,
    _callerFile: baseConfig._callerFile ?? getCallerFile(),
    _callerLocation: baseConfig._callerLocation ?? getCallerLocation(),
  };

  const renderValidation = await validateRender(template, config, context);
  if (isErr(renderValidation)) { return err(renderValidation.error); }

  const loader = getLoader(config as Parameters<typeof getLoader>[0]);
  let templateSource: string;
  let templatePath: string | null;
  try {
    ({ templateSource, templatePath } = await resolveTemplateSource(template, loader, config));
  } catch (resolveErr) {
    return err(await wrapWithLog(resolveErr, config, { template, renderContext: context }));
  }
  const configWithPath: RenderConfig = templatePath ? { ...config, templatePath } : config;

  const sourceValidation = await validateTemplateSource(templateSource, configWithPath, context);
  if (isErr(sourceValidation)) { return err(sourceValidation.error); }

  const templateName = resolveTemplateName(template, configWithPath);

  const compileResult = compileTemplate(templateSource, configWithPath, templateName);
  if (isErr(compileResult)) {
    return err(await wrapWithLog(compileResult.error, configWithPath, { template: templateSource, renderContext: context }));
  }
  const { code } = compileResult.value;

  const { warningsCollector, context: safeContext } = await handleContextStrictMode(context, configWithPath);
  const sandboxedCtx = prepareSandbox(configWithPath, safeContext);
  const envOverride = buildRenderEnv(loader, configWithPath);
  const resolvedConfig: RenderConfig = envOverride ? { ...configWithPath, env: envOverride } : configWithPath;

  let result: string;
  try {
    result = await executeCompiledTemplate({
      code,
      sandboxedCtx,
      warningsCollector,
      templateName,
    }, resolvedConfig);
  } catch (executeErr) {
    return err(await wrapWithLog(executeErr, resolvedConfig, { template: templateSource, renderContext: context }));
  }

  return ok(injectWarningsIfNeeded(result, warningsCollector, resolvedConfig.dev));
};

export { render };
export type { RenderConfig };
