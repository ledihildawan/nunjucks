import EventEmitter from 'node:events';
import { readFile } from 'node:fs/promises';
import { createCompiler } from '@nunjucks/compiler';
import { parse } from '@nunjucks/parser';
import { transform } from '@nunjucks/transformers';
import { execute, type ExecuteConfig } from '@nunjucks/runtime/executor';
import { validateTemplate, validateConfig, validateRenderContext, findContextDangerousValues } from './validators/index.js';
import { withTimeout } from '@nunjucks/runtime/timeout';
import { createSandboxedContext } from '@nunjucks/runtime/sandbox';
import { scrubDangerousReferences } from '@nunjucks/runtime/security';
import { getCallerFile, getCallerLocation } from '@nunjucks/shared/caller-file';
import { createLog, injectWarningsScript, getError } from '@nunjucks/log';
import { findContextKeyPosition, wrapWithLog } from '@nunjucks/log/diagnostics';
import { getLoader } from './engine.js';
import { createEnv, type Env } from './env.js';
import { createTemplate } from '../template/index.js';
import type { SourceMapMapping } from '@nunjucks/compiler/source-map';

interface LoaderSource {
  src: string;
  path: string;
  noCache?: boolean;
}

interface ResolveResult {
  templateSource: string;
  templatePath: string | null;
}

interface ValidationError {
  message: string;
  code?: string;
  subject?: string;
  lineno?: number;
  colno?: number;
  dangerousPaths?: string[];
}

interface CallerLocation {
  fileName: string;
  lineNumber?: number | null;
  columnNumber?: number | null;
}

type Environment = 'auto' | 'node' | 'browser' | 'deno';

interface SandboxOptions {
  allowlist?: string[];
  blocklistMode?: boolean;
  blockedContextKeys?: string[];
  environment?: Environment;
}

export interface RenderConfig {
  dev?: boolean;
  autoescape?: boolean;
  undefined?: string;
  globals?: Record<string, unknown>;
  sandbox?: boolean;
  sandboxAllowlist?: string[];
  sandboxMode?: string;
  sandboxEnvironment?: string;
  contextStrict?: boolean | 'error';
  production?: boolean;
  allowedGlobals?: readonly string[];
  executionTimeout?: number;
  env?: unknown;
  templatePath?: string | null;
  jsCaller?: string | null;
  jsCallerErrorLine?: number | null;
  jsCallerErrorCol?: number | null;
  _callerFile?: string | null;
  _callerLocation?: CallerLocation | null;
  _autoCallerLocation?: boolean;
  _customFilters?: Record<string, unknown>;
  _customGlobals?: Record<string, unknown>;
  [key: string]: unknown;
}

const resolveTemplateSource = async (template: string, loader: unknown, config: RenderConfig): Promise<ResolveResult> => {
  if (!loader || template.includes('{{') || template.includes('{%') || template.includes('{#')) {
    return { templateSource: template, templatePath: null };
  }

  try {
    const source = await (loader as { getSource: (name: string) => Promise<LoaderSource | null> }).getSource(template);
    if (source?.src) {
      return {
        templateSource: source.src,
        templatePath: config.templatePath ? null : source.path
      };
    }
  } catch (loaderErr) {
    const code = (loaderErr as { code?: string })?.code;
    if (code === 'ENOENT' || code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') {
      return { templateSource: template, templatePath: null };
    }
    throw loaderErr;
  }

  return { templateSource: template, templatePath: null };
};

const createValidationError = async (validationError: ValidationError, stamps: Record<string, unknown>, config: RenderConfig, templateSource: string | null, context: unknown): Promise<never> => {
  const err = new Error(validationError.message);
  Object.assign(err, stamps);
  throw await wrapWithLog(err, config, templateSource, context);
};

const getDangerousValueStamps = async (contextError: ValidationError, config: RenderConfig): Promise<Record<string, unknown>> => {
  const stamps: Record<string, unknown> = { code: contextError.code };
  const dangerousPaths = contextError.dangerousPaths;
  if (!dangerousPaths?.length) return stamps;

  const callerLocation = config._callerLocation;
  if (!callerLocation || callerLocation.fileName === 'unknown') return stamps;

  const pos = await findContextKeyPosition(callerLocation.fileName, callerLocation.lineNumber || 1, dangerousPaths[0]!);
  if (pos) {
    stamps.lineno = pos.line;
    stamps.colno = pos.col;
    stamps.lineBase = 'one';
  }
  return stamps;
};

const prepareSandbox = (config: RenderConfig, context: unknown): Record<string, unknown> => {
  const internalKeys = ['__nunjucks_undefined_mode', 'exports', 'module', 'require', '__dirname', '__filename', 'global', 'globalThis', 'process'];
  const userAllowlist = config.sandboxAllowlist || [];
  const mergedAllowlist = [...new Set([...internalKeys, ...userAllowlist])];

  const blockedKeys = config.blockedContextKeys as readonly string[] | null | undefined;
  const sandboxOptions: SandboxOptions = {
    allowlist: mergedAllowlist,
    blocklistMode: config.sandboxMode !== 'allowlist',
    blockedContextKeys: blockedKeys ? [...blockedKeys] : undefined,
    environment: (config.sandboxEnvironment || 'auto') as Environment,
  };

  const sandboxEnabled = (config.sandbox ?? false) || (blockedKeys != null && blockedKeys.length > 0);
  const sandboxedCtx = createSandboxedContext(context, sandboxEnabled, sandboxOptions) as Record<string, unknown>;
  sandboxedCtx.__nunjucks_undefined_mode = config.undefined || 'default';
  return sandboxedCtx;
};

const buildRenderEnv = (loader: unknown, config: RenderConfig): void => {
  if (!loader || config.env) return;

  const emitter = new EventEmitter();
  config.env = createEnv({
    opts: {
      dev: config.dev ?? false,
      autoescape: config.autoescape ?? true,
      undefined: config.undefined ?? 'default'
    },
    globals: config.globals || {},
    emitter,
    async getTemplate(name: string, eagerCompile?: boolean, includeChain?: unknown[] | null, ignoreMissing?: boolean) {
      const source = await (loader as { getSource: (name: string) => Promise<LoaderSource | null> }).getSource(name);
      if (!source) {
        if (ignoreMissing) return null;
        throw createLog('error', getError('FILE_NOT_FOUND'), { path: name }, name, { phase: 'load' });
      }
      return createTemplate(source.src, this as unknown as Env, source.path, eagerCompile ?? true, includeChain);
    }
  });
};

interface CompileResult {
  code: string;
  sourceMapData: SourceMapMapping[];
}

const compileTemplate = (templateSource: string, config: RenderConfig, templateName: string): CompileResult => {
  const c = createCompiler(templateName, (config.undefined || 'chainable') as 'chainable' | 'strict' | 'debug', templateSource);
  // biome-ignore lint/suspicious/noExplicitAny: Parser API requires dynamic typing
  const ast = (parse as any)(templateSource, [], { undefined: config.undefined });
  // biome-ignore lint/suspicious/noExplicitAny: Transformer API requires dynamic typing
  const transformedAst = (transform as any)(ast, [], templateName);
  c.compile(transformedAst);
  return { code: c.getCode(), sourceMapData: c.getSourceMap().mappings };
};

const handleContextStrictMode = async (context: unknown, config: RenderConfig): Promise<{ warningsCollector: unknown[]; dangerousValuePaths: string[] }> => {
  const warningsCollector: unknown[] = [];
  const contextStrict = config.contextStrict === true || (config.contextStrict !== false && config.dev === true);
  const dangerousValuePaths = contextStrict ? findContextDangerousValues(context, config) : [];

  if (!contextStrict || dangerousValuePaths.length === 0) {
    return { warningsCollector, dangerousValuePaths };
  }

  const errorMessage = `Context contains unsafe values: ${dangerousValuePaths.join(', ')}`;

  if (config.contextStrict === 'error' || config.production === true) {
    const err = new Error(errorMessage);
    (err as Error & { code: string }).code = 'DANGEROUS_CONTEXT_VALUES';
    (err as Error & { subject: string }).subject = dangerousValuePaths.join(', ');
    throw await wrapWithLog(err as Error, config, null, context);
  }

  scrubDangerousReferences(context, config.allowedGlobals ?? null);
  warningsCollector.push(createLog('warning', {
    name: 'DANGEROUS_CONTEXT_VALUE_SCRUBBED',
    message: () => `Scrubbed unsafe values from context: ${dangerousValuePaths.join(', ')}`,
    pattern: /./
  } as Parameters<typeof createLog>[1], { values: dangerousValuePaths.join(', ') }, dangerousValuePaths.join(', '), {
    phase: 'render',
    lineBase: 'zero'
  } as Parameters<typeof createLog>[4]));

  return { warningsCollector, dangerousValuePaths };
};

const validateRenderInput = async (template: unknown, config: RenderConfig, context: unknown): Promise<void> => {
  if (typeof template !== 'string') {
    const err = createLog('error', getError('TEMPLATE_MUST_BE_STRING'), {}, null, { phase: 'render' });
    throw await wrapWithLog(err as Error, config, template as string | null, context);
  }

  const validation = validateConfig(config as Parameters<typeof validateConfig>[0]);
  if (!validation.valid) {
    const ve = validation.errors[0] as NonNullable<typeof validation.errors[0]>;
    const callerLineno = config._callerLocation?.lineNumber;
    const callerColno = config._callerLocation?.columnNumber;
    await createValidationError(ve, {
      code: ve.code,
      subject: ve.subject,
      lineno: callerLineno && callerLineno > 1 ? callerLineno - 1 : callerLineno,
      colno: callerColno
    }, config, template, context);
  }

  const templateValidation = validateTemplate(template, config as unknown as Parameters<typeof validateTemplate>[1]);
  if (!templateValidation.valid) {
    const ve = templateValidation.errors[0] as NonNullable<typeof templateValidation.errors[0]>;
    await createValidationError(ve, { lineno: ve.lineno, colno: ve.colno, code: ve.code, subject: ve.subject }, config, template, context);
  }

  const contextValidation = validateRenderContext(context, config as unknown as Parameters<typeof validateRenderContext>[1]);
  if (!contextValidation.valid) {
    const ce = contextValidation.errors[0] as NonNullable<typeof contextValidation.errors[0]>;
    const stamps = await getDangerousValueStamps(ce, config);
    await createValidationError(ce, stamps, config, template, context);
  }
};

export const render = async (template: string, context: Record<string, unknown> = {}, config: RenderConfig = {}): Promise<string> => {
  config._callerFile = config._callerFile || getCallerFile();
  config._callerLocation = config._callerLocation || getCallerLocation();

  if (config._autoCallerLocation && !config.jsCaller && config._callerFile && config._callerFile !== 'unknown') {
    try {
      if (typeof template === 'string') {
        const callerLine = config._callerLocation?.lineNumber;
        const source = await readFile(config._callerFile, 'utf8');
        let searchFrom = 0;
        let foundNearCaller = false;
        while (callerLine != null) {
          const templateIndex = source.indexOf(template, searchFrom);
          if (templateIndex === -1) break;
          const occurrenceLine = source.slice(0, templateIndex).split('\n').length;
          if (Math.abs(occurrenceLine - callerLine) <= 5) {
            foundNearCaller = true;
            break;
          }
          searchFrom = templateIndex + 1;
        }
        if (foundNearCaller) {
          config.jsCaller = config._callerFile;
        }
      }
    } catch {
      // Diagnostics will fall back to the template source when the caller
      // cannot be read.
    }
  }
  if (config.jsCaller && config.jsCallerErrorLine == null) {
    config.jsCallerErrorLine = config._callerLocation?.lineNumber ?? 1;
  }
  if (config.jsCaller && config.jsCallerErrorCol == null) {
    config.jsCallerErrorCol = config._callerLocation?.columnNumber ?? 1;
  }

  await validateRenderInput(template, config, context);

  const loader = getLoader(config as Parameters<typeof getLoader>[0]);
  const { templateSource, templatePath } = await resolveTemplateSource(template, loader, config);
  if (templatePath) config.templatePath = templatePath;

  const looksLikeFile = /\.(njk|js|html|htm|twig|ejs|eta)$/i.test(template);
  const templateName = config.templatePath || (looksLikeFile ? template : (config._callerFile || 'inline'));

  let code: string;
  let sourceMapData: SourceMapMapping[];
  try {
    ({ code, sourceMapData } = compileTemplate(templateSource, config, templateName));
  } catch (err) {
    throw await wrapWithLog(err as Error, config, templateSource, context);
  }

  const { warningsCollector } = await handleContextStrictMode(context, config);
  const sandboxedCtx = prepareSandbox(config, context);
  buildRenderEnv(loader, config);

  let result: unknown;
  try {
    const renderPromise = execute(code, sandboxedCtx, {
      ...config,
      warningsCollector,
      templateName,
      sourceMapData,
      renderContext: context
    } as ExecuteConfig);

    result = (config.executionTimeout ?? 0) > 0
      ? await withTimeout(renderPromise, config.executionTimeout ?? 0)
      : await renderPromise;
  } catch (err) {
    throw await wrapWithLog(err as Error, config, templateSource, context);
  }

  if (warningsCollector.length > 0 && config.dev) {
    result = result + injectWarningsScript(warningsCollector as Parameters<typeof injectWarningsScript>[0], { dev: true, verbosity: 'medium' });
  }

  return result as string;
};

export const renderWithEnv = async (templateName: string, env: unknown, context: Record<string, unknown> = {}, config: RenderConfig = {}): Promise<string> => {
  const fullConfig: RenderConfig = { ...config, templatePath: config.templatePath || templateName, env };

  const validation = validateConfig(config as Parameters<typeof validateConfig>[0]);
  if (!validation.valid) {
    const ve = validation.errors[0] as NonNullable<typeof validation.errors[0]>;
    const err = createLog('error', {
      name: ve.code || 'CONFIG_ERROR',
      message: () => ve.message,
      pattern: /./,
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
      pattern: /./,
    } as Parameters<typeof createLog>[1], {}, ce.message, {
      phase: 'render',
      templateName: fullConfig.templatePath || templateName,
      lineBase: 'zero',
      ...stamps
    } as Parameters<typeof createLog>[4]);
    throw await wrapWithLog(err as Error, fullConfig, null, context);
  }

  let template: unknown;
  try {
    template = await (env as { getTemplate?: (name: string, eagerCompile: boolean, includeChain: unknown, ignoreMissing: boolean) => Promise<unknown> }).getTemplate?.(templateName, true, templateName, false);

    if (typeof (template as { render?: unknown })?.render === 'function') {
      return await (template as { render: (ctx: unknown) => Promise<string> }).render(context);
    }

    throw createLog('error', getError('TEMPLATE_NO_RENDER'), {}, null, { phase: 'render' });
  } catch (err) {
    throw await wrapWithLog(err as Error, fullConfig, (template as { tmplStr?: string })?.tmplStr ?? null, context);
  }
};
