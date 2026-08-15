import { getError } from '@nunjucks/error-catalog';
import type { TemplateError, TemplateWarning } from '@nunjucks/error-formatter';
import { createLog } from '@nunjucks/error-formatter';
import { err, isErr, isKeyedObject, ok, type Result } from '@nunjucks/lib';
import { createFileSystemLoader, type FileSystemLoader, type TemplateLoader } from '@nunjucks/loaders';
import type { ParseOptions, ParserExtension } from '@nunjucks/parser';
import { createSandboxedContext } from '@nunjucks/runtime';
import { findContextDangerousValues } from '@nunjucks/validators';
import { scrubDangerousReferences } from '@nunjucks/validators/security';
import { compileToCode } from '../compile-pipeline.ts';
import { findContextKeyPosition, wrapWithLog } from '../diagnostics/diagnostics.ts';
import type { CompileResult, RenderConfig, SandboxOptions } from './render-types.ts';

const TEMPLATE_FILE_EXTENSION_RE = /\.(njk|js|html|htm|twig|ejs|eta)$/i;

interface ResolveTemplateSourceInput {
  template: string;
  loader: TemplateLoader | null;
  config: RenderConfig;
}

interface ResolvedTemplateSource {
  templateSource: string;
  templatePath: string | null;
}

// WHY: returns Result like its sibling prepareRender steps; the raw loader error stays
// `unknown` here and is enriched (wrapWithLog) by the caller, which owns the renderContext.
const resolveTemplateSource = async ({
  template,
  loader,
  config,
}: ResolveTemplateSourceInput): Promise<Result<ResolvedTemplateSource, unknown>> => {
  if (!loader || template.includes('{{') || template.includes('{%') || template.includes('{#')) {
    return ok({ templateSource: template, templatePath: null });
  }

  const sourceResult = await loader.getSource(template);
  if (sourceResult === null) {
    return ok({ templateSource: template, templatePath: null });
  }
  if (isErr(sourceResult)) {
    const loaderError: unknown = sourceResult.error;
    const errorCode =
      isKeyedObject(loaderError) && typeof loaderError.code === 'string' ? loaderError.code : null;
    if (
      errorCode === 'ENOENT' ||
      errorCode === 'MODULE_NOT_FOUND' ||
      errorCode === 'ERR_MODULE_NOT_FOUND'
    ) {
      return ok({ templateSource: template, templatePath: null });
    }
    return err(loaderError);
  }
  const source = sourceResult.value;
  if (source.src) {
    const resolvedPath: string | null = config.templatePath ? null : source.path;
    return ok({
      templateSource: source.src,
      templatePath: resolvedPath,
    });
  }

  return ok({ templateSource: template, templatePath: null });
};

const prepareSandbox = (
  config: RenderConfig,
  context: Record<string, unknown>
): Record<string, unknown> => {
  // WHY: internalKeys are always allowed in sandbox — they are either runtime-internal markers (__nunjucks_undefined_mode) or CommonJS leakage guards (exports, module, require, __dirname, __filename) or Node globals the template runtime legitimately needs (global, globalThis, process for env checks).
  const internalKeys = [
    '__nunjucks_undefined_mode',
    'exports',
    'module',
    'require',
    '__dirname',
    '__filename',
    'global',
    'globalThis',
    'process',
  ];
  const userAllowlist = config.sandboxAllowlist || [];
  const mergedAllowlist = [...new Set([...internalKeys, ...userAllowlist])];

  const blockedKeys = config.blockedContextKeys;
  const resolvedBlockedKeys: string[] | undefined =
    blockedKeys !== null && blockedKeys !== undefined ? [...blockedKeys] : undefined;
  const sandboxOptions: SandboxOptions = {
    allowlist: mergedAllowlist,
    blocklistMode: config.sandboxMode !== 'allowlist',
    blockedContextKeys: resolvedBlockedKeys,
    environment: config.sandboxEnvironment || 'auto',
  };

  const sandboxEnabled = (config.sandbox ?? false) || (blockedKeys?.length ?? 0) > 0;
  const mergedContext = { ...context, ...config.globals };
  // WHY: createSandboxedContext's contract (sandbox.ts) is shape-preserving — it passes
  // non-objects through unchanged and proxies objects in place, so narrowing the `unknown`
  // return back to the merged context shape is sound.
  const sandboxedCtx = createSandboxedContext({
    context: mergedContext,
    sandboxEnabled,
    options: sandboxOptions,
  }) as Record<string, unknown>;
  return sandboxedCtx;
};

interface CompileTemplateInput {
  templateSource: string;
  config: RenderConfig;
  templateName: string;
}

const isParserExtension = (value: unknown): value is ParserExtension =>
  isKeyedObject(value) && Array.isArray(value.tags) && typeof value.parse === 'function';

const compileTemplate = ({
  templateSource,
  config,
  templateName,
}: CompileTemplateInput): Result<CompileResult, Error> => {
  // WHY: convert config.extensions (name → ext object map) into the ParserExtension[] the parser expects —
  // each value carries `tags` + `parse`; the map key is the lookup name used by env.getExtension at runtime.
  // Non-conforming values are dropped silently and purely here; misconfigured extensions surface through
  // factory-time config validation.
  const parserExtensions = config.extensions
    ? Object.values(config.extensions).filter(isParserExtension)
    : undefined;
  const parseOpts: ParseOptions = {
    trimBlocks: config.trimBlocks,
    lstripBlocks: config.lstripBlocks,
  };
  const codeResult = compileToCode({
    source: templateSource,
    templateName,
    undefinedMode: config.undefined,
    parseOpts,
    streamErrorRecovery: config.streamErrorRecovery ?? false,
    extensions: parserExtensions,
  });
  return isErr(codeResult) ? codeResult : ok({ code: codeResult.value });
};

interface DangerousContextInput {
  context: Record<string, unknown>;
  config: RenderConfig;
  dangerousValuePaths: string[];
}

// WHY: isolated error creation for context strict mode — walks caller frames to locate the dangerous value in consumer code, enriches config with jsCaller for location resolution, and scrubs the context before display. Separated from handleContextStrictMode so the main function reads as a simple check-then-throw-or-scrub flow.
const createDangerousContextError = async ({
  context,
  config,
  dangerousValuePaths,
}: DangerousContextInput): Promise<TemplateError> => {
  const subject = dangerousValuePaths.join(', ');
  const firstPath = dangerousValuePaths[0] ?? '';
  const callerFrames = config.callerFrames ?? [];
  const framePositions = await Promise.all(
    callerFrames.map((frame) =>
      frame.fileName !== 'unknown' && firstPath
        ? findContextKeyPosition({
            sourceFile: frame.fileName,
            callLine: frame.lineNumber ?? 1,
            dangerousPath: firstPath,
          })
            .then((pos) => (pos ? { ...pos, fileName: frame.fileName } : null))
            // WHY: enrichment is best-effort — a failed lookup must never turn the never-rejecting
            // render() contract into an unexpected rejection.
            .catch(() => null)
        : Promise.resolve(null)
    )
  );
  const contextPos =
    framePositions.find(
      (pos): pos is { line: number; col: number; fileName: string } => pos !== null
    ) ?? null;
  const dangerousContextError = createLog('error', {
    def: getError('DANGEROUS_CONTEXT_VALUES'),
    params: { values: subject },
    subject,
    context: contextPos
      ? {
          phase: 'render',
          lineno: contextPos.line,
          colno: contextPos.col,
          lineBase: 'one' as const,
        }
      : { phase: 'render' },
  });
  const enrichedConfig = contextPos
    ? {
        ...config,
        jsCaller: contextPos.fileName,
        jsCallerErrorLine: contextPos.line,
        jsCallerErrorCol: contextPos.col,
      }
    : config;
  const safeForDisplay = scrubDangerousReferences(context);
  return wrapWithLog({
    error: dangerousContextError,
    config: enrichedConfig,
    renderContext: safeForDisplay,
  });
};

interface ContextStrictModeOutcome {
  warningsCollector: TemplateWarning[];
  context: Record<string, unknown>;
}

const handleContextStrictMode = async (
  context: Record<string, unknown>,
  config: RenderConfig
): Promise<Result<ContextStrictModeOutcome, TemplateError>> => {
  const warningsCollector: TemplateWarning[] = [];
  const contextStrict =
    config.contextStrict === true || (config.contextStrict !== false && config.dev === true);
  const dangerousValuePaths: string[] = contextStrict
    ? findContextDangerousValues(context, config)
    : [];

  if (!contextStrict || dangerousValuePaths.length === 0) {
    return ok({ warningsCollector, context });
  }

  if (config.contextStrict === 'error') {
    return err(await createDangerousContextError({ context, config, dangerousValuePaths }));
  }

  // WHY: scrubber's structural invariant (scrubber.ts) guarantees record-in → record-out,
  // so narrowing the `unknown` return back to the context shape is sound.
  const scrubbedContext = scrubDangerousReferences(context) as Record<string, unknown>;
  const scrubWarning = createLog('warning', {
    def: getError('DANGEROUS_CONTEXT_VALUE_SCRUBBED'),
    params: { values: dangerousValuePaths.join(', ') },
    subject: dangerousValuePaths.join(', '),
    context: {
      phase: 'render',
      lineBase: 'zero',
    },
  });

  return ok({ warningsCollector: [scrubWarning], context: scrubbedContext });
};

// WHY: empty views array must NOT fall through to the loader's '.' default root.
const resolveConfiguredLoader = (config: RenderConfig): FileSystemLoader | null => {
  const views = config.views;
  if (views === null || views === undefined || views.length === 0) {
    return null;
  }
  return createFileSystemLoader(views);
};

export {
  compileTemplate,
  handleContextStrictMode,
  prepareSandbox,
  resolveConfiguredLoader,
  resolveTemplateSource,
  TEMPLATE_FILE_EXTENSION_RE,
};
