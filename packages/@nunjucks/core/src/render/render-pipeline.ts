import { getError } from '@nunjucks/error-catalog';
import type { TemplateError, TemplateWarning } from '@nunjucks/error-formatter';
import { createLog } from '@nunjucks/error-formatter';
import { err, isErr, isKeyedObject, ok, type Result } from '@nunjucks/lib';
import type { TemplateLoader } from '@nunjucks/loaders';
import { createSandboxedContext } from '@nunjucks/runtime';
import { findContextDangerousValues, scrubDangerousReferences } from '@nunjucks/validators';
import { compileToCode, resolveParserExtensions } from '../compile-pipeline.ts';
import { findContextKeyPosition, wrapWithLog } from '../diagnostics/diagnostics.ts';
import { buildCompileCacheKey } from '../template/template-cache.ts';
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

// WHY: an extension-bearing name that a configured loader cannot resolve is almost
// certainly a typo'd file reference — silently rendering the literal filename as the
// page is the worst failure mode. Extension-less misses keep the inline fallback
// (inline templates must keep working without any loader hit).
const resolveLoaderMiss = (template: string): Result<ResolvedTemplateSource, unknown> =>
  TEMPLATE_FILE_EXTENSION_RE.test(template)
    ? err(
        createLog('error', {
          def: getError('FILE_NOT_FOUND'),
          params: { path: template },
          subject: template,
          context: { phase: 'load' },
        })
      )
    : ok({ templateSource: template, templatePath: null });

const isLoaderMissCode = (loaderError: unknown): boolean => {
  const errorCode =
    isKeyedObject(loaderError) && typeof loaderError.code === 'string' ? loaderError.code : null;
  return (
    errorCode === 'ENOENT' ||
    errorCode === 'MODULE_NOT_FOUND' ||
    errorCode === 'ERR_MODULE_NOT_FOUND'
  );
};

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
    return resolveLoaderMiss(template);
  }
  if (isErr(sourceResult)) {
    if (isLoaderMissCode(sourceResult.error)) {
      return resolveLoaderMiss(template);
    }
    return err(sourceResult.error);
  }
  const source = sourceResult.value;
  // WHY: config.loaders is a user-supplied JS boundary — narrow the envelope's src at the
  // edge instead of trusting the TemplateLoaderSource type, so a contract-violating loader
  // cannot smuggle a non-string into templateSource (which the compiler types as string).
  if (typeof source.src === 'string') {
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
  // WHY: only runtime-internal markers are force-allowed — every former CommonJS/Node-global
  // entry (exports, module, require, __dirname, __filename, global, globalThis, process) is
  // categorically blocked by @nunjucks/shared blocked-key categories, which the sandbox traps
  // enforce BEFORE the allowlist (sandbox-traps.ts validateStringKey), so allowlisting them was
  // dead at best and a latent bypass hazard at worst. Pinned by sandbox-security.test.ts.
  const internalKeys = ['__nunjucks_undefined_mode'];
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

const compileTemplate = ({
  templateSource,
  config,
  templateName,
}: CompileTemplateInput): Result<CompileResult, Error> => {
  // WHY: compiled-code cache consult — only for loader-resolved templates (a real
  // templatePath); inline template strings are often dynamic and skip the cache by
  // design. The key includes the source CONTENT hash, so a hit means byte-identical
  // source + identical compile inputs; stale output is structurally impossible.
  const cacheKey =
    config.compiledCodeCache && config.templatePath
      ? buildCompileCacheKey({
          templatePath: config.templatePath,
          templateName,
          source: templateSource,
          config,
        })
      : null;
  if (cacheKey !== null) {
    const cachedCode = config.compiledCodeCache?.get(cacheKey);
    if (cachedCode !== undefined) {
      return ok({ code: cachedCode });
    }
  }
  const codeResult = compileToCode({
    source: templateSource,
    templateName,
    undefinedMode: config.undefined,
    parseOpts: {
      trimBlocks: config.trimBlocks,
      lstripBlocks: config.lstripBlocks,
    },
    streamErrorRecovery: config.streamErrorRecovery ?? false,
    extensions: resolveParserExtensions(config.extensions),
    expressionSecurity: config.expressionSecurity,
  });
  // WHY: only successful compiles are cached — a failed parse/compile must retry
  // cleanly on the next render instead of pinning its error in the LRU.
  if (!isErr(codeResult) && cacheKey !== null) {
    config.compiledCodeCache?.set(cacheKey, codeResult.value);
  }
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
    callerFrames.map(async (frame) => {
      if (frame.fileName === 'unknown' || !firstPath) {
        return null;
      }
      // WHY: enrichment is best-effort — a failed lookup must never turn the never-rejecting
      // render() contract into an unexpected rejection.
      try {
        const pos = await findContextKeyPosition({
          sourceFile: frame.fileName,
          callLine: frame.lineNumber ?? 1,
          dangerousPath: firstPath,
        });
        return pos ? { ...pos, fileName: frame.fileName } : null;
      } catch {
        return null;
      }
    })
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

export {
  compileTemplate,
  handleContextStrictMode,
  prepareSandbox,
  resolveTemplateSource,
  TEMPLATE_FILE_EXTENSION_RE,
};
