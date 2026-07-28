import EventEmitter from 'node:events';
import { createCompiler } from '@nunjucks/compiler';
import { parse } from '@nunjucks/parser';
import type { ParseOptions } from '@nunjucks/parser';
import { transform } from '@nunjucks/transformers';
import { validateTemplate, validateConfig, validateRenderContext, findContextDangerousValues } from '@nunjucks/validators';
import { createSandboxedContext } from '@nunjucks/runtime/sandbox';
import { scrubDangerousReferences } from '@nunjucks/runtime/security';
import { createLog, getError } from '@nunjucks/log';
import { findContextKeyPosition, wrapWithLog } from '@nunjucks/log/diagnostics';
import { createEnv, type Env } from './env.ts';
import { createTemplate } from '../template/index.ts';
import type { RenderConfig, ValidationError, LoaderSource, CompileResult, Environment, SandboxOptions, ValidationErrorRequest } from './render-types.ts';

const MATCH_ANY_RE = /./;
const TEMPLATE_FILE_EXTENSION_RE = /\.(njk|js|html|htm|twig|ejs|eta)$/i;

const resolveTemplateSource = async (template: string, loader: unknown, config: RenderConfig): Promise<{ templateSource: string; templatePath: string | null }> => {
  if (!loader || template.includes('{{') || template.includes('{%') || template.includes('{#')) {
    return { templateSource: template, templatePath: null };
  }

  try {
    const source = await (loader as { getSource: (name: string) => Promise<LoaderSource | null> }).getSource(template);
    if (source?.src) {
      let resolvedPath: string | null;
      if (config.templatePath) {
        resolvedPath = null;
      } else {
        resolvedPath = source.path;
      }
      return {
        templateSource: source.src,
        templatePath: resolvedPath
      };
    }
  } catch (loaderErr) {
    const { code } = loaderErr as { code?: string };
    if (code === 'ENOENT' || code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') {
      return { templateSource: template, templatePath: null };
    }
    throw loaderErr;
  }

  return { templateSource: template, templatePath: null };
};

const createValidationError = async ({
  validationError,
  stamps,
  config,
  templateSource,
  context,
}: ValidationErrorRequest): Promise<never> => {
  const err = new Error(validationError.message);
  Object.assign(err, stamps);
  throw await wrapWithLog(err, config, templateSource, context);
};

const getDangerousValueStamps = async (contextError: ValidationError, config: RenderConfig): Promise<Record<string, unknown>> => {
  const stamps: Record<string, unknown> = { code: contextError.code };
  const firstDangerousPath = contextError.dangerousPaths?.[0];
  if (!firstDangerousPath) { return stamps; }

  const callerLocation = config._callerLocation;
  if (!callerLocation || callerLocation.fileName === 'unknown') { return stamps; }

  const pos = await findContextKeyPosition(callerLocation.fileName, callerLocation.lineNumber || 1, firstDangerousPath);
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
  let resolvedBlockedKeys: string[] | undefined;
  if (blockedKeys !== null && blockedKeys !== undefined) {
    resolvedBlockedKeys = [...blockedKeys];
  } else {
    resolvedBlockedKeys = undefined;
  }
  const sandboxOptions: SandboxOptions = {
    allowlist: mergedAllowlist,
    blocklistMode: config.sandboxMode !== 'allowlist',
    blockedContextKeys: resolvedBlockedKeys,
    environment: (config.sandboxEnvironment || 'auto') as Environment,
  };

  const sandboxEnabled = (config.sandbox ?? false) || (blockedKeys !== null && blockedKeys !== undefined && blockedKeys.length > 0);
  const mergedContext = { ...(context as Record<string, unknown>), ...config.globals };
  const sandboxedCtx = createSandboxedContext(mergedContext, sandboxEnabled, sandboxOptions) as Record<string, unknown>;
  sandboxedCtx.__nunjucks_undefined_mode = config.undefined || 'default';
  return sandboxedCtx;
};

const buildRenderEnv = (loader: unknown, config: RenderConfig): void => {
  if (!loader || config.env) { return; }

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
        if (ignoreMissing) { return null; }
        throw createLog('error', getError('FILE_NOT_FOUND'), { path: name }, name, { phase: 'load' });
      }
      return createTemplate(source.src, this as unknown as Env, source.path, eagerCompile ?? true, includeChain);
    }
  });
};

const compileTemplate = (templateSource: string, config: RenderConfig, templateName: string): CompileResult => {
  const c = createCompiler(templateName, (config.undefined || 'chainable') as 'chainable' | 'strict' | 'debug', templateSource);
  const ast = parse(templateSource, [], { undefined: config.undefined } as ParseOptions);
  const transformedAst = transform(ast);
  c.compile(transformedAst);
  return { code: c.getCode() };
};

const handleContextStrictMode = async (context: unknown, config: RenderConfig): Promise<{ warningsCollector: unknown[]; dangerousValuePaths: string[] }> => {
  const warningsCollector: unknown[] = [];
  const contextStrict = config.contextStrict === true || (config.contextStrict !== false && config.dev === true);
  let dangerousValuePaths: string[];
  if (contextStrict) {
    dangerousValuePaths = findContextDangerousValues(context, config);
  } else {
    dangerousValuePaths = [];
  }

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
    pattern: MATCH_ANY_RE
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
    let resolvedLineno: number | null | undefined = callerLineno;
    if (callerLineno && callerLineno > 1) {
      resolvedLineno = callerLineno - 1;
    }
    await createValidationError({
      validationError: ve,
      stamps: {
        code: ve.code,
        subject: ve.subject,
        lineno: resolvedLineno,
        colno: callerColno
      },
      config,
      templateSource: template,
      context
    });
  }

  const templateValidation = validateTemplate(template, config as unknown as Parameters<typeof validateTemplate>[1]);
  if (!templateValidation.valid) {
    const ve = templateValidation.errors[0] as NonNullable<typeof templateValidation.errors[0]>;
    await createValidationError({
      validationError: ve,
      stamps: { lineno: ve.lineno, colno: ve.colno, code: ve.code, subject: ve.subject },
      config,
      templateSource: template,
      context
    });
  }

  const contextValidation = validateRenderContext(context, config as unknown as Parameters<typeof validateRenderContext>[1]);
  if (!contextValidation.valid) {
    const ce = contextValidation.errors[0] as NonNullable<typeof contextValidation.errors[0]>;
    const stamps = await getDangerousValueStamps(ce, config);
    await createValidationError({ validationError: ce, stamps, config, templateSource: template, context });
  }
};

export { resolveTemplateSource, createValidationError, getDangerousValueStamps, prepareSandbox, buildRenderEnv, compileTemplate, handleContextStrictMode, validateRenderInput, MATCH_ANY_RE, TEMPLATE_FILE_EXTENSION_RE };
