import type { TemplateError, TemplateWarning } from '@nunjucks/error-formatter';
import { injectWarningsScript } from '@nunjucks/error-renderer';
import { err, isErr, ok, type Result } from '@nunjucks/lib';
import { createFileSystemLoader, type TemplateLoader } from '@nunjucks/loaders';
import { createFrame, type ExecuteConfig, execute } from '@nunjucks/runtime';
import { getDefaultConfig } from '../config/global.ts';
import { wrapWithLog } from '../diagnostics/diagnostics.ts';
import { defaultFilterBundle } from '../filter-bundle.ts';
import { getCallerFrames } from './caller-file.ts';
import { buildExecutionEnv, buildRenderEnv } from './render-env.ts';
import {
  compileTemplate,
  handleContextStrictMode,
  prepareSandbox,
  resolveTemplateSource,
  TEMPLATE_FILE_EXTENSION_RE,
} from './render-pipeline.ts';
import { createRenderStream, formatErrorMarker } from './render-stream.ts';
import { guardSingleConsumer } from './render-stream-adapters.ts';
import type {
  PreparedTemplate,
  RenderConfig,
  RenderOptions,
  RenderStreamResult,
} from './render-types.ts';
import { validateRender, validateTemplateSource } from './render-validation.ts';
import { buildCallableMap } from './render-callable.ts';

const setupRenderConfig = (
  options: Partial<import('../config/global.ts').GlobalConfig>
): Result<RenderConfig, TemplateError> => {
  const defaults = getDefaultConfig(defaultFilterBundle);
  const filtersResult = buildCallableMap(
    { ...defaults.filters, ...(options.filters || {}) },
    'filters'
  );
  if (isErr(filtersResult)) {
    return filtersResult;
  }
  const testsResult = buildCallableMap(options.tests, 'tests');
  if (isErr(testsResult)) {
    return testsResult;
  }
  const filters = options.dompurify
    ? // WHY: copy-on-write — the validated map is never mutated in place; the sanitize
      // default is rebound to the host's DOMPurify config in a fresh object.
      {
        ...filtersResult.value,
        sanitize: (str: unknown, config?: unknown): unknown => {
          const baseSanitize = filtersResult.value.sanitize;
          return baseSanitize ? baseSanitize(str, config ?? options.dompurify) : undefined;
        },
      }
    : filtersResult.value;

  // WHY: explicit scanContextValues wins (§9); downgrade only when sandbox/contextStrict set.
  const layeredSecurityExplicitlySet =
    options.contextStrict !== undefined || options.sandbox !== undefined;
  return ok({
    ...defaults,
    ...options,
    blockedContextKeys: options.blockedContextKeys ?? defaults.blockedContextKeys ?? undefined,
    filters,
    tests: testsResult.value,
    globals: { ...defaults.globals, ...(options.globals || {}) },
    scanContextValues:
      options.scanContextValues ??
      (layeredSecurityExplicitlySet ? false : defaults.scanContextValues),
  });
};

const resolveTemplateName = (template: string, config: RenderConfig): string => {
  if (config.templatePath) {
    return config.templatePath;
  }
  if (TEMPLATE_FILE_EXTENSION_RE.test(template)) {
    return template;
  }
  return config.callerFile || 'inline';
};

const resolveConfiguredLoader = (config: RenderConfig): TemplateLoader | null => {
  if (config.loader) {
    return config.loader;
  }
  const views = config.views;
  if (!views || (Array.isArray(views) && views.length === 0)) {
    return null;
  }
  return createFileSystemLoader(views);
};

const executeCompiledTemplate = async (
  ctx: {
    code: string;
    sandboxedCtx: Record<string, unknown>;
    warningsCollector: TemplateWarning[];
    templateName: string | null;
  },
  config: RenderConfig
): Promise<string> => {
  const frame = createFrame();
  const env = config.env ?? buildExecutionEnv(config);
  // WHY: deadline enforced cooperatively in the executor's chunk drain (microtask-only
  // chain starves macrotask timers); diagnostics fields wire logContext + the warnings
  // slot — without them dev undefined-warnings hit console.warn.
  return execute({
    code: ctx.code,
    context: ctx.sandboxedCtx,
    frame,
    env,
    config: {
      ...(config as ExecuteConfig),
      executionTimeoutMs: config.executionTimeout ?? 0,
      templateName: ctx.templateName ?? undefined,
      renderContext: ctx.sandboxedCtx,
      warningsCollector: ctx.warningsCollector,
    },
  });
};

const injectWarningsIfNeeded = ({
  result,
  warningsCollector,
  dev,
}: {
  result: string;
  warningsCollector: TemplateWarning[];
  dev: boolean | undefined;
}): string =>
  warningsCollector.length > 0 && dev
    ? result + injectWarningsScript(warningsCollector, { dev: true, verbosity: 'medium' })
    : result;

const prepareRender = async (
  template: string,
  { context = {}, ...options }: RenderOptions = {}
): Promise<Result<PreparedTemplate, TemplateError>> => {
  const baseConfigResult = setupRenderConfig(options);
  if (isErr(baseConfigResult)) {
    return baseConfigResult;
  }
  const baseConfig = baseConfigResult.value;
  const callerFrames = baseConfig.callerFrames ?? getCallerFrames();
  const primaryCaller = callerFrames[0] ?? null;
  const config: RenderConfig = {
    ...baseConfig,
    callerFrames,
    callerFile: baseConfig.callerFile ?? primaryCaller?.fileName ?? 'unknown',
    callerLocation: baseConfig.callerLocation ?? primaryCaller,
  };

  // WHY: sequential gates ON PURPOSE — fail-fast checks over available data;
  // parallelizing would surface a less specific error first. Only
  // resolveTemplateSource performs I/O and must not run for invalid input.
  const renderValidation = await validateRender(template, { config, context });
  if (isErr(renderValidation)) {
    return renderValidation;
  }

  const strictResult = await handleContextStrictMode(context, config);
  if (isErr(strictResult)) {
    return strictResult;
  }
  const { warningsCollector, context: safeContext } = strictResult.value;

  const loader = resolveConfiguredLoader(config);
  const sourceResult = await resolveTemplateSource({ template, loader, config });
  if (isErr(sourceResult)) {
    return err(
      await wrapWithLog({ error: sourceResult.error, config, template, renderContext: safeContext })
    );
  }
  const { templateSource, templatePath } = sourceResult.value;
  const configWithPath: RenderConfig = templatePath ? { ...config, templatePath } : config;

  const sourceValidation = await validateTemplateSource(templateSource, {
    config: configWithPath,
    context: safeContext,
  });
  if (isErr(sourceValidation)) {
    return sourceValidation;
  }

  const templateName = resolveTemplateName(template, configWithPath);

  const compileResult = compileTemplate({ templateSource, config: configWithPath, templateName });
  if (isErr(compileResult)) {
    return err(
      await wrapWithLog({
        error: compileResult.error,
        config: configWithPath,
        template: templateSource,
        renderContext: safeContext,
      })
    );
  }
  const { code } = compileResult.value;

  const sandboxedCtx = prepareSandbox(configWithPath, safeContext);
  const envOverride = buildRenderEnv(loader, configWithPath);
  const resolvedConfig: RenderConfig = envOverride
    ? { ...configWithPath, env: envOverride }
    : configWithPath;

  return ok({
    code,
    sandboxedCtx,
    warningsCollector,
    templateName,
    resolvedConfig,
    templateSource,
    context: safeContext,
    streamContentType: options.streamContentType ?? 'html',
    version: resolvedConfig.version,
  });
};

const render = async (
  template: string,
  options: RenderOptions = {}
): Promise<Result<string, TemplateError>> => {
  const prepared = await prepareRender(template, options);
  if (isErr(prepared)) {
    return prepared;
  }

  const {
    code,
    sandboxedCtx,
    warningsCollector,
    templateName,
    resolvedConfig,
    templateSource,
    context,
  } = prepared.value;
  let result: string;
  try {
    result = await executeCompiledTemplate(
      { code, sandboxedCtx, warningsCollector, templateName },
      resolvedConfig
    );
  } catch (executeErr: unknown) {
    return err(
      await wrapWithLog({
        error: executeErr,
        config: resolvedConfig,
        template: templateSource,
        renderContext: context,
      })
    );
  }
  return ok(injectWarningsIfNeeded({ result, warningsCollector, dev: resolvedConfig.dev }));
};
const renderToStream = async (
  template: string,
  options: RenderOptions = {}
): Promise<RenderStreamResult> => {
  const prepared = await prepareRender(template, options);
  if (isErr(prepared)) {
    return prepared;
  }
  return ok(guardSingleConsumer(createRenderStream(prepared.value)));
};

export type { RenderConfig, RenderOptions, RenderStreamResult };
export { formatErrorMarker, render, renderToStream };
