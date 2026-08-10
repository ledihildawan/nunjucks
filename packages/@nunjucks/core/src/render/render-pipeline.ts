import { findContextDangerousValues } from '@nunjucks/validators';
import type { ParseOptions, ParserExtension } from '@nunjucks/parser';
import type { Env } from '@nunjucks/runtime';
import { createSandboxedContext } from '@nunjucks/runtime';
import { createLog, getError, type IncludeChain, type TemplateWarning, type TemplateError } from '@nunjucks/log';
import { wrapWithLog, findContextKeyPosition } from '../diagnostics/diagnostics.ts';
import { scrubDangerousReferences, ok, isErr, type Result } from '@nunjucks/shared';
import type { FileSystemLoader } from '@nunjucks/loaders';
import { createTemplate } from '../template/index.ts';
import { compileToCode } from '../compile-pipeline.ts';
import type { RenderConfig, CompileResult, SandboxOptions } from './render-types.ts';

const TEMPLATE_FILE_EXTENSION_RE = /\.(njk|js|html|htm|twig|ejs|eta)$/i;

interface ResolveTemplateSourceInput {
  template: string;
  loader: FileSystemLoader | null;
  config: RenderConfig;
}

const resolveTemplateSource = async ({ template, loader, config }: ResolveTemplateSourceInput): Promise<{ templateSource: string; templatePath: string | null }> => {
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
  // WHY: internalKeys are always allowed in sandbox — they are either runtime-internal markers (__nunjucks_undefined_mode) or CommonJS leakage guards (exports, module, require, __dirname, __filename) or Node globals the template runtime legitimately needs (global, globalThis, process for env checks).
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

const createEnvLookups = (config: RenderConfig): Pick<Env, 'getFilter' | 'getTest' | 'getExtension'> => ({
  getFilter: (name: string, lineno: number | null, colno: number | null) => {
    const filter = config.filters?.[name];
    if (filter) { return filter; }
    throw createLog('error', { def: getError('UNDEFINED_FILTER'), params: { name }, subject: name, context: { lineno, colno, phase: 'render', lineBase: 'zero' } });
  },
  getTest: (name: string, lineno: number | null, colno: number | null) => {
    const test = config.tests?.[name];
    if (test) { return test; }
    throw createLog('error', { def: getError('UNDEFINED_TEST'), params: { name }, subject: name, context: { lineno, colno, phase: 'render', lineBase: 'zero' } });
  },
  getExtension: (name: string) => {
    const extension = config.extensions?.[name];
    if (extension !== undefined) { return extension; }
    throw createLog('error', { def: getError('UNDEFINED_EXTENSION'), params: { name }, subject: name, context: { phase: 'render', lineBase: 'zero' } });
  },
});

const buildRenderEnv = (loader: FileSystemLoader | null, config: RenderConfig): Env | null => {
  if (!loader || config.env) { return null; }

  return {
    opts: {
      dev: config.dev ?? false,
      autoescape: config.autoescape ?? true,
      undefined: config.undefined ?? 'default',
    },
    ...createEnvLookups(config),
    async getTemplate(this: Env, name: string, eagerCompile?: boolean, includeChain?: IncludeChain | null, ignoreMissing?: boolean) {
      const source = await loader.getSource(name);
      if (!source) {
        if (ignoreMissing) { return null; }
        throw createLog('error', { def: getError('FILE_NOT_FOUND'), params: { path: name }, subject: name, context: { phase: 'load' } });
      }
      return createTemplate({ src: source.src, env: this, path: source.path, eagerCompile: eagerCompile ?? true, includeChain });
    },
  };
};

interface CompileTemplateInput {
  templateSource: string;
  config: RenderConfig;
  templateName: string;
}

const compileTemplate = ({ templateSource, config, templateName }: CompileTemplateInput): Result<CompileResult, Error> => {
  // WHY: convert config.extensions (name → ext object map) into the ParserExtension[] the parser expects —
  // each value carries `tags` + `parse`; the map key is the lookup name used by env.getExtension at runtime.
  const parserExtensions = config.extensions ? (Object.values(config.extensions) as readonly ParserExtension[]) : undefined;
  const codeResult = compileToCode({ source: templateSource, templateName, undefinedMode: config.undefined, parseOpts: { undefined: config.undefined, trimBlocks: config.trimBlocks, lstripBlocks: config.lstripBlocks } as ParseOptions, streamErrorRecovery: config.streamErrorRecovery ?? false, extensions: parserExtensions });
  return isErr(codeResult) ? codeResult : ok({ code: codeResult.value });
};

interface DangerousContextInput {
  context: Record<string, unknown>;
  config: RenderConfig;
  dangerousValuePaths: string[];
}

// WHY: isolated error creation for context strict mode — walks caller frames to locate the dangerous value in consumer code, enriches config with jsCaller for location resolution, and scrubs the context before display. Separated from handleContextStrictMode so the main function reads as a simple check-then-throw-or-scrub flow.
const createDangerousContextError = async ({ context, config, dangerousValuePaths }: DangerousContextInput): Promise<TemplateError> => {
  const subject = dangerousValuePaths.join(', ');
  const firstPath = dangerousValuePaths[0] ?? '';
  const callerFrames = config.callerFrames ?? [];
  const framePositions = await Promise.all(
    callerFrames.map(frame =>
      frame.fileName !== 'unknown' && firstPath
        ? findContextKeyPosition({ sourceFile: frame.fileName, callLine: frame.lineNumber ?? 1, dangerousPath: firstPath }).then(pos => pos ? { ...pos, fileName: frame.fileName } : null)
        : Promise.resolve(null),
    ),
  );
  const contextPos = framePositions.find((pos): pos is { line: number; col: number; fileName: string } => pos !== null) ?? null;
  const err = createLog('error', {
    def: getError('DANGEROUS_CONTEXT_VALUES'),
    params: { values: subject },
    subject,
    context: contextPos
      ? { phase: 'render', lineno: contextPos.line, colno: contextPos.col, lineBase: 'one' as const }
      : { phase: 'render' },
  });
  const enrichedConfig = contextPos
    ? { ...config, jsCaller: contextPos.fileName, jsCallerErrorLine: contextPos.line, jsCallerErrorCol: contextPos.col }
    : config;
  const safeForDisplay = scrubDangerousReferences(context) as Record<string, unknown>;
  return wrapWithLog(err, enrichedConfig, { renderContext: safeForDisplay });
};

const handleContextStrictMode = async (context: Record<string, unknown>, config: RenderConfig): Promise<{ warningsCollector: TemplateWarning[]; dangerousValuePaths: string[]; context: Record<string, unknown> }> => {
  const warningsCollector: TemplateWarning[] = [];
  const contextStrict = config.contextStrict === true || (config.contextStrict !== false && config.dev === true);
  const dangerousValuePaths: string[] = contextStrict ? findContextDangerousValues(context, config) : [];

  if (!contextStrict || dangerousValuePaths.length === 0) {
    return { warningsCollector, dangerousValuePaths, context };
  }

  if (config.contextStrict === 'error') {
    throw await createDangerousContextError({ context, config, dangerousValuePaths });
  }

  const scrubbedContext = scrubDangerousReferences(context) as Record<string, unknown>;
  const scrubWarning = createLog('warning', {
    def: getError('DANGEROUS_CONTEXT_VALUE_SCRUBBED'),
    params: { values: dangerousValuePaths.join(', ') },
    subject: dangerousValuePaths.join(', '),
    context: {
      phase: 'render',
      lineBase: 'zero'
    }
  });

  return { warningsCollector: [scrubWarning], dangerousValuePaths, context: scrubbedContext };
};

export { resolveTemplateSource, prepareSandbox, buildRenderEnv, compileTemplate, handleContextStrictMode, createEnvLookups, TEMPLATE_FILE_EXTENSION_RE };
