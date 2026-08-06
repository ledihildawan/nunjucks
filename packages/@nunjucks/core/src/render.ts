import { resolveTemplateSource, prepareSandbox, buildRenderEnv, compileTemplate, handleContextStrictMode, createEnvLookups, TEMPLATE_FILE_EXTENSION_RE } from './render-helpers.ts';
import { validateRender, validateTemplateSource } from './render-validation.ts';
import { getLoader } from './engine.ts';
import type { RenderConfig } from './render-types.ts';
import { execute, createFrame, withTimeout, type ExecuteConfig } from '@nunjucks/runtime';
import { getCallerFile, getCallerLocation } from '@nunjucks/shared';
import { injectWarningsScript, wrapWithLog } from '@nunjucks/log';
import type { GlobalConfig } from './config/global.ts';
import { getDefaultConfig } from './config/global.ts';
import { defaultFilterBundle } from './filter-bundle.ts';

interface ExecutionContext {
  code: string;
  sandboxedCtx: Record<string, unknown>;
  warningsCollector: Error[];
  templateName: string | null;
}

const setupRenderConfig = (options: Partial<GlobalConfig>): RenderConfig => {
  const defaults = getDefaultConfig(defaultFilterBundle);
  const filters = { ...defaults.filters, ...(options.filters || {}) };

  // Bake the per-render dompurify config into the sanitize filter closure so
  // it applies to this render only, instead of mutating a shared global default.
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

const executeCompiledTemplate = async (ctx: ExecutionContext, config: RenderConfig, context: Record<string, unknown>): Promise<string> => {
  const frame = createFrame();
  const env = config.env ?? {
    opts: {
      dev: config.dev ?? false,
      autoescape: config.autoescape ?? true,
      undefined: config.undefined ?? 'default',
    },
    ...createEnvLookups(config),
  };
  const renderPromise = execute(ctx.code, ctx.sandboxedCtx, frame, env, {
    ...config,
    warningsCollector: ctx.warningsCollector,
    templateName: ctx.templateName,
    renderContext: context
  } as ExecuteConfig);

  if ((config.executionTimeout ?? 0) > 0) {
    return await withTimeout(renderPromise, config.executionTimeout ?? 0);
  }
  return await renderPromise;
};

const injectWarningsIfNeeded = (result: string, warningsCollector: unknown[], dev: boolean | undefined): string => {
  if (warningsCollector.length > 0 && dev) {
    return result + injectWarningsScript(warningsCollector as Parameters<typeof injectWarningsScript>[0], { dev: true, verbosity: 'medium' });
  }
  return result;
};

const render = async (template: string, context: Record<string, unknown> = {}, options: Partial<GlobalConfig> = {}): Promise<string> => {
  const baseConfig = setupRenderConfig(options);
  const config: RenderConfig = {
    ...baseConfig,
    _callerFile: baseConfig._callerFile || getCallerFile(),
    _callerLocation: baseConfig._callerLocation || getCallerLocation(),
  };

  await validateRender(template, config, context);

  const loader = getLoader(config as Parameters<typeof getLoader>[0]);
  const { templateSource, templatePath } = await resolveTemplateSource(template, loader, config);
  const configWithPath: RenderConfig = templatePath ? { ...config, templatePath } : config;

  await validateTemplateSource(templateSource, configWithPath, context);

  const templateName = resolveTemplateName(template, configWithPath);

  let code: string;
  try {
    ({ code } = compileTemplate(templateSource, configWithPath, templateName));
  } catch (err) {
    throw await wrapWithLog(err, configWithPath, templateSource, context);
  }

  const { warningsCollector, context: safeContext } = await handleContextStrictMode(context, configWithPath);
  const sandboxedCtx = prepareSandbox(configWithPath, safeContext as Record<string, unknown>);
  const envOverride = buildRenderEnv(loader, configWithPath);
  const resolvedConfig: RenderConfig = envOverride ? { ...configWithPath, env: envOverride } : configWithPath;

  let result: string;
  try {
    result = await executeCompiledTemplate({
      code,
      sandboxedCtx,
      warningsCollector: warningsCollector as Error[],
      templateName,
    }, resolvedConfig, safeContext as Record<string, unknown>);
  } catch (err) {
    throw await wrapWithLog(err, resolvedConfig, templateSource, context);
  }

  return injectWarningsIfNeeded(result, warningsCollector, resolvedConfig.dev);
};

export { render };
export type { RenderConfig };
