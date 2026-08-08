import EventEmitter from 'node:events';
import { findContextDangerousValues } from '@nunjucks/validators';
import type { ParseOptions } from '@nunjucks/parser';
import type { Env } from '@nunjucks/runtime';
import { createSandboxedContext } from '@nunjucks/runtime';
import { createLog, getError, wrapWithLog, type IncludeChain, type TemplateWarning } from '@nunjucks/log';
import { MATCH_ANY_RE, scrubDangerousReferences } from '@nunjucks/shared';
import type { FileSystemLoader } from '@nunjucks/loaders';
import { createTemplate } from '../template/index.ts';
import { compileToCode } from '../compile-pipeline.ts';
import type { RenderConfig, CompileResult, SandboxOptions } from './render-types.ts';

const TEMPLATE_FILE_EXTENSION_RE = /\.(njk|js|html|htm|twig|ejs|eta)$/i;

const resolveTemplateSource = async (template: string, loader: FileSystemLoader | null, config: RenderConfig): Promise<{ templateSource: string; templatePath: string | null }> => {
  if (!loader || template.includes('{{') || template.includes('{%') || template.includes('{#')) {
    return { templateSource: template, templatePath: null };
  }

  try {
    const source = await loader.getSource(template);
    if (source?.src) {
      const resolvedPath: string | null = config.templatePath ? null : source.path;
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

const prepareSandbox = (config: RenderConfig, context: Record<string, unknown>): Record<string, unknown> => {
  const internalKeys = ['__nunjucks_undefined_mode', 'exports', 'module', 'require', '__dirname', '__filename', 'global', 'globalThis', 'process'];
  const userAllowlist = config.sandboxAllowlist || [];
  const mergedAllowlist = [...new Set([...internalKeys, ...userAllowlist])];

  const blockedKeys = config.blockedContextKeys;
  const resolvedBlockedKeys: string[] | undefined = (blockedKeys !== null && blockedKeys !== undefined) ? [...blockedKeys] : undefined;
  const sandboxOptions: SandboxOptions = {
    allowlist: mergedAllowlist,
    blocklistMode: config.sandboxMode !== 'allowlist',
    blockedContextKeys: resolvedBlockedKeys,
    environment: config.sandboxEnvironment || 'auto',
  };

  const sandboxEnabled = (config.sandbox ?? false) || ((blockedKeys?.length ?? 0) > 0);
  const mergedContext = { ...context, ...config.globals };
  const sandboxedCtx = createSandboxedContext(mergedContext, sandboxEnabled, sandboxOptions) as Record<string, unknown>;
  return sandboxedCtx;
};

const createEnvLookups = (config: RenderConfig): Pick<Env, 'getFilter' | 'getTest'> => ({
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
});

const buildRenderEnv = (loader: FileSystemLoader | null, config: RenderConfig): Env | null => {
  if (!loader || config.env) { return null; }

  const emitter = new EventEmitter();
  return {
    opts: {
      dev: config.dev ?? false,
      autoescape: config.autoescape ?? true,
      undefined: config.undefined ?? 'default',
    },
    emitter,
    ...createEnvLookups(config),
    async getTemplate(this: Env, name: string, eagerCompile?: boolean, includeChain?: IncludeChain | null, ignoreMissing?: boolean) {
      const source = await loader.getSource(name);
      if (!source) {
        if (ignoreMissing) { return null; }
        throw createLog('error', getError('FILE_NOT_FOUND'), { path: name }, name, { phase: 'load' });
      }
      return createTemplate({ src: source.src, env: this, path: source.path, eagerCompile: eagerCompile ?? true, includeChain });
    },
  };
};

const compileTemplate = (templateSource: string, config: RenderConfig, templateName: string): CompileResult => {
  const code = compileToCode({ source: templateSource, templateName, undefinedMode: config.undefined, parseOpts: { undefined: config.undefined } as ParseOptions });
  return { code };
};

const handleContextStrictMode = async (context: Record<string, unknown>, config: RenderConfig): Promise<{ warningsCollector: TemplateWarning[]; dangerousValuePaths: string[]; context: Record<string, unknown> }> => {
  const warningsCollector: TemplateWarning[] = [];
  const contextStrict = config.contextStrict === true || (config.contextStrict !== false && config.dev === true);
  const dangerousValuePaths: string[] = contextStrict ? findContextDangerousValues(context, config) : [];

  if (!contextStrict || dangerousValuePaths.length === 0) {
    return { warningsCollector, dangerousValuePaths, context };
  }

  if (config.contextStrict === 'error') {
    const subject = dangerousValuePaths.join(', ');
    const err = createLog(
      'error',
      { name: 'DANGEROUS_CONTEXT_VALUES', message: `Context contains unsafe values: ${subject}` },
      undefined,
      subject,
      { phase: 'render' },
    );
    throw await wrapWithLog(err, config, { renderContext: context });
  }

  const scrubbedContext = scrubDangerousReferences(context) as Record<string, unknown>;
  const scrubWarning = createLog('warning', {
    name: 'DANGEROUS_CONTEXT_VALUE_SCRUBBED',
    message: () => `Scrubbed unsafe values from context: ${dangerousValuePaths.join(', ')}`,
    pattern: MATCH_ANY_RE
  }, { values: dangerousValuePaths.join(', ') }, dangerousValuePaths.join(', '), {
    phase: 'render',
    lineBase: 'zero'
  });

  return { warningsCollector: [scrubWarning], dangerousValuePaths, context: scrubbedContext };
};

export { resolveTemplateSource, prepareSandbox, buildRenderEnv, compileTemplate, handleContextStrictMode, createEnvLookups, TEMPLATE_FILE_EXTENSION_RE };
