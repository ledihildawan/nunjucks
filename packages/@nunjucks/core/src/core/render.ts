import { resolveTemplateSource, prepareSandbox, buildRenderEnv, compileTemplate, handleContextStrictMode, validateRenderInput, getDangerousValueStamps, MATCH_ANY_RE, TEMPLATE_FILE_EXTENSION_RE } from './render-helpers.ts';
import { getLoader } from './engine.ts';
import type { RenderConfig } from './render-types.ts';
import { execute, type ExecuteConfig } from '@nunjucks/runtime/executor';
import { createFrame } from '@nunjucks/runtime';
import { withTimeout } from '@nunjucks/runtime/timeout';
import { getCallerFile, getCallerLocation } from '@nunjucks/shared/caller-file';
import { createLog, injectWarningsScript, getError } from '@nunjucks/log';
import { wrapWithLog } from '@nunjucks/log/diagnostics';
import type { GlobalConfig } from '../config/global.ts';
import { getDefaultConfig, setDefaultDomPurifyConfig } from '../config/global.ts';
import { validateConfig, validateRenderContext } from '@nunjucks/validators';

const setupRenderConfig = (options: Partial<GlobalConfig>): RenderConfig => {
  if (options.dompurify) {
    setDefaultDomPurifyConfig(options.dompurify);
  }

  const defaults = getDefaultConfig();
  return {
    ...defaults,
    ...options,
    filters: { ...defaults.filters, ...(options.filters || {}) },
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

const executeCompiledTemplate = async (
  code: string,
  sandboxedCtx: Record<string, unknown>,
  config: RenderConfig,
  context: Record<string, unknown>,
  warningsCollector: unknown[],
  templateName: string
): Promise<unknown> => {
  const frame = createFrame();
  const env = config.env ?? {
    opts: {
      dev: config.dev ?? false,
      autoescape: config.autoescape ?? true,
      undefined: config.undefined ?? 'default',
    },
    getFilter: (name: string, lineno: number | null, colno: number | null) => {
      const filter = config.filters?.[name];
      if (filter) { return filter; }
      throw createLog('error', getError('UNDEFINED_FILTER'), { name }, name, { lineno, colno, phase: 'render', lineBase: 'zero' });
    },
    getTest: (name: string, lineno: number | null, colno: number | null) => {
      const test = config.tests?.[name];
      if (test) { return test; }
      throw createLog('error', getError('UNDEFINED_TEST'), { name }, name, { lineno, colno, phase: 'render', lineBase: 'zero' });
    },
  };
  const renderPromise = execute(code, sandboxedCtx, frame, env, {
    ...config,
    warningsCollector,
    templateName,
    renderContext: context
  } as ExecuteConfig);

  if ((config.executionTimeout ?? 0) > 0) {
    return await withTimeout(renderPromise, config.executionTimeout ?? 0) as string;
  }
  return await renderPromise as string;
};

const injectWarningsIfNeeded = (result: unknown, warningsCollector: unknown[], dev: boolean | undefined): string => {
  if (warningsCollector.length > 0 && dev) {
    return (result as string) + injectWarningsScript(warningsCollector as Parameters<typeof injectWarningsScript>[0], { dev: true, verbosity: 'medium' });
  }
  return result as string;
};

const validateRenderWithEnvConfig = async (config: RenderConfig, templateName: string, context: Record<string, unknown>, fullConfig: RenderConfig): Promise<void> => {
  const validation = validateConfig(config as Parameters<typeof validateConfig>[0]);
  if (!validation.valid) {
    const ve = validation.errors[0] as NonNullable<typeof validation.errors[0]>;
    const err = createLog('error', {
      name: ve.code || 'CONFIG_ERROR',
      message: () => ve.message,
      pattern: MATCH_ANY_RE,
    } as Parameters<typeof createLog>[1], {}, ve.message, {
      phase: 'render',
      templateName: fullConfig.templatePath || templateName,
      lineBase: 'zero'
    } as Parameters<typeof createLog>[4]);
    throw await wrapWithLog(err as Error, fullConfig, null, context);
  }

  const contextValidation = validateRenderContext(context, config as unknown as Parameters<typeof validateRenderContext>[1]);
  if (!contextValidation.valid) {
    const ce = contextValidation.errors[0] as NonNullable<typeof contextValidation.errors[0]>;
    const stamps = await getDangerousValueStamps(ce, config);
    const err = createLog('error', {
      name: ce.code || 'CONTEXT_ERROR',
      message: () => ce.message,
      pattern: MATCH_ANY_RE,
    } as Parameters<typeof createLog>[1], {}, ce.message, {
      phase: 'render',
      templateName: fullConfig.templatePath || templateName,
      lineBase: 'zero',
      ...stamps
    } as Parameters<typeof createLog>[4]);
    throw await wrapWithLog(err as Error, fullConfig, null, context);
  }
};

const renderFromEnvTemplate = async (env: unknown, templateName: string, context: Record<string, unknown>, fullConfig: RenderConfig): Promise<string> => {
  let template: unknown;
  try {
    template = await (env as { getTemplate?: (name: string, eagerCompile: boolean, includeChain: unknown, ignoreMissing: boolean) => Promise<unknown> }).getTemplate?.(templateName, true, templateName, false);

    if (typeof (template as { render?: unknown } | undefined)?.render === 'function') {
      return await (template as { render: (ctx: unknown) => Promise<string> }).render(context);
    }

    throw createLog('error', getError('TEMPLATE_NO_RENDER'), {}, null, { phase: 'render' });
  } catch (err) {
    throw await wrapWithLog(err as Error, fullConfig, (template as { tmplStr?: string } | undefined)?.tmplStr ?? null, context);
  }
};

const render = async (template: string, context: Record<string, unknown> = {}, options: Partial<GlobalConfig> = {}): Promise<string> => {
  const config = setupRenderConfig(options);
  config._callerFile = config._callerFile || getCallerFile();
  config._callerLocation = config._callerLocation || getCallerLocation();

  await validateRenderInput(template, config, context);

  const loader = getLoader(config as Parameters<typeof getLoader>[0]);
  const { templateSource, templatePath } = await resolveTemplateSource(template, loader, config);
  if (templatePath) { config.templatePath = templatePath; }

  const templateName = resolveTemplateName(template, config);

  let code: string;
  try {
    ({ code } = compileTemplate(templateSource, config, templateName));
  } catch (err) {
    throw await wrapWithLog(err as Error, config, templateSource, context);
  }

  const { warningsCollector } = await handleContextStrictMode(context, config);
  const sandboxedCtx = prepareSandbox(config, context);
  buildRenderEnv(loader, config);

  let result: unknown;
  try {
    result = await executeCompiledTemplate(code, sandboxedCtx as Record<string, unknown>, config, context, warningsCollector, templateName);
  } catch (err) {
    throw await wrapWithLog(err as Error, config, templateSource, context);
  }

  return injectWarningsIfNeeded(result, warningsCollector, config.dev);
};

const renderWithEnv = async (templateName: string, env: unknown, context: Record<string, unknown> = {}, config: RenderConfig = {}): Promise<string> => {
  const fullConfig: RenderConfig = { ...config, templatePath: config.templatePath || templateName, env };

  await validateRenderWithEnvConfig(config, templateName, context, fullConfig);
  return await renderFromEnvTemplate(env, templateName, context, fullConfig);
};

export { render, renderWithEnv };
export type { RenderConfig };
