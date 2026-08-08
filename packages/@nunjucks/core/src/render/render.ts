import { resolveTemplateSource, prepareSandbox, buildRenderEnv, compileTemplate, handleContextStrictMode, createEnvLookups, TEMPLATE_FILE_EXTENSION_RE } from './render-pipeline.ts';
import { validateRender, validateTemplateSource } from './render-validation.ts';
import { getLoader } from '../engine.ts';
import type { RenderConfig } from './render-types.ts';
import { execute, createFrame, withTimeout } from '@nunjucks/runtime';
import { getCallerFile, getCallerLocation } from './caller-file.ts';
import { ok, err, isErr, type Result } from '@nunjucks/shared';
import { injectWarningsScript, type TemplateWarning, type TemplateError } from '@nunjucks/log';
import { wrapWithLog } from '../diagnostics/diagnostics.ts';
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

interface RenderOptions extends Partial<GlobalConfig> {
  context?: Record<string, unknown>;
}

const render = async (template: string, { context = {}, ...options }: RenderOptions = {}): Promise<Result<string, TemplateError>> => {
  const baseConfig = setupRenderConfig(options);
  const config: RenderConfig = {
    ...baseConfig,
    callerFile: baseConfig.callerFile ?? getCallerFile(),
    callerLocation: baseConfig.callerLocation ?? getCallerLocation(),
  };

  const renderValidation = await validateRender(template, { config, context });
  if (isErr(renderValidation)) { return err(renderValidation.error); }

  const loader = getLoader(config);
  let templateSource: string;
  let templatePath: string | null;
  try {
    ({ templateSource, templatePath } = await resolveTemplateSource(template, loader, config));
  } catch (resolveErr) {
    return err(await wrapWithLog(resolveErr, config, { template, renderContext: context }));
  }
  const configWithPath: RenderConfig = templatePath ? { ...config, templatePath } : config;

  const sourceValidation = await validateTemplateSource(templateSource, { config: configWithPath, context });
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
export type { RenderConfig, RenderOptions };
