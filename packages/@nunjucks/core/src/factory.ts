import { getError } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import { createLog } from '@nunjucks/error-formatter';
import type { Result } from '@nunjucks/lib';
import { isErr } from '@nunjucks/lib';
import {
  createFileSystemLoader,
  createLoaderChain,
  type FileSystemLoader,
  type TemplateLoader,
} from '@nunjucks/loaders';
import { validateConfig } from '@nunjucks/validators';
import { PACKAGE_VERSION } from './config/global.ts';
import type {
  NunjucksConfig,
  NunjucksEngine,
  PerRenderOverrides,
} from './config/nunjucks-config.ts';
import { foldPlugins } from './plugin/index.ts';
import type { PipeRenderStreamOptions, PipeSink } from './render/pipe-stream.ts';
import { pipeRenderStream as pipeRenderStreamInternal } from './render/pipe-stream.ts';
import {
  render as renderInternal,
  renderToStream as renderToStreamInternal,
} from './render/render.ts';
import type { RenderOptions, RenderStreamResult } from './render/render-types.ts';
import { createTemplateCache } from './template/template-cache.ts';

// WHY: NODE_ENV is read opportunistically — the engine must stay runnable in non-Node runtimes
// (browsers/edge) where the global does not exist, mirroring diagnostics.ts's runtime-agnostic stance.
const readRuntimeEnvironment = (): string =>
  typeof process === 'undefined' ? 'development' : (process.env.NODE_ENV ?? 'development');

// WHY: strip keys whose value is undefined so they do NOT override the engine's built-in defaults when the
// base bag is spread into the internal render options ({ ...defaults, ...options }). A present-undefined key
// (e.g. sandbox: undefined from an absent security group) would clobber the default; removing it lets the
// default survive. null is preserved (it is meaningful for blockedContextKeys etc.).
const compact = (record: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));

interface FactoryValidationInput {
  filters: Record<string, unknown>;
  globals: Record<string, unknown>;
  tests: Record<string, unknown>;
}

// WHY: factory is the shell boundary — creating an engine from invalid config is a programmer error, so it
// fails fast with a catalog-enriched TemplateError instead of deferring to per-render validation. Note: globals
// values are deliberately NOT callable-checked — globals are data (strings, objects), unlike filters/tests.
const assertValidConfig = (config: NunjucksConfig, merged: FactoryValidationInput): void => {
  const validation = validateConfig({
    executionTimeout: config.limits?.executionTimeout,
    maxTemplateSize: config.limits?.maxTemplateSize,
    maxOutputSize: config.limits?.maxOutputSize,
    streamingCoalesceBytes: config.streaming?.coalesceBytes,
    streamingIdleTimeout: config.streaming?.idleTimeout,
    streamContentType: config.streaming?.contentType,
    cacheMaxEntries: config.cache?.maxEntries,
    undefined: config.undefined,
    sandboxMode: config.security?.sandboxMode,
    sandboxEnvironment: config.security?.sandboxEnvironment,
    blockedContextKeys: config.security?.blockedContextKeys,
    sandboxAllowlist: config.security?.sandboxAllowlist,
    allowedGlobals: config.security?.allowedGlobals,
    views: config.views,
    customFilters: merged.filters,
    customTests: merged.tests,
    customGlobals: merged.globals,
  });
  if (isErr(validation)) {
    const [primary, ...rest] = validation.error;
    const suffix =
      rest.length > 0 ? ` (+${rest.length} more: ${rest.map((e) => e.message).join('; ')})` : '';
    throw createLog('error', {
      def: { ...getError('INVALID_CONFIG'), message: () => `${primary.message}${suffix}` },
      params: {},
      subject: primary.subject,
      context: { phase: 'render', lineBase: 'zero' },
    });
  }
};

// WHY: flatten the nested NunjucksConfig into the flat options bag the internal render pipeline expects, after
// folding plugins. Layering order (lowest → highest precedence): built-in defaults (applied inside render) →
// plugin filters/globals/tests/extensions → user's direct filters/globals/tests/extensions. Security/limits/
// streaming groups are flattened 1:1 to their existing flat keys.
const buildBaseOptions = (config: NunjucksConfig): RenderOptions => {
  const folded = foldPlugins(config.plugins);
  // WHY: merged once so the same map feeds both rendering (filters/globals) and the security name-validation
  // (customFilters/customGlobals read by validateConfig in render-validation.ts). Without this mapping the
  // validator's reserved/dangerous-name check silently skips factory-supplied filters/globals.
  const mergedFilters = { ...folded.filters, ...config.filters };
  const mergedGlobals = { ...folded.globals, ...config.globals };
  const mergedTests = { ...folded.tests, ...config.tests };
  assertValidConfig(config, { filters: mergedFilters, globals: mergedGlobals, tests: mergedTests });
  return compact({
    dev: config.dev,
    autoescape: config.autoescape,
    undefined: config.undefined,
    trimBlocks: config.trimBlocks,
    lstripBlocks: config.lstripBlocks,
    ide: config.ide,
    version: PACKAGE_VERSION,
    views: config.views,
    // WHY: an explicit config label wins over the NODE_ENV sniff so non-Node hosts
    // (browsers/edge/tests) can pin what diagnostics display.
    environment: config.environment ?? readRuntimeEnvironment(),
    sandbox: config.security?.sandbox,
    sandboxMode: config.security?.sandboxMode,
    sandboxAllowlist: config.security?.sandboxAllowlist,
    sandboxEnvironment: config.security?.sandboxEnvironment,
    blockedContextKeys: config.security?.blockedContextKeys,
    expressionSecurity: config.security?.expressionSecurity,
    contextStrict: config.security?.contextStrict,
    scanContextValues: config.security?.scanContextValues,
    strictMode: config.security?.strictMode,
    allowedGlobals: config.security?.allowedGlobals,
    executionTimeout: config.limits?.executionTimeout,
    maxTemplateSize: config.limits?.maxTemplateSize,
    maxOutputSize: config.limits?.maxOutputSize,
    streamErrorRecovery: config.streaming?.errorRecovery,
    streamContentType: config.streaming?.contentType,
    // WHY: default ON — cache keys carry the source content hash, so enabling it
    // changes only speed, never output; cache.templates:false restores
    // always-recompile behavior for hosts that want it.
    compiledCodeCache:
      config.cache?.templates === false
        ? null
        : createTemplateCache({ maxEntries: config.cache?.maxEntries }),
    filters: mergedFilters,
    globals: mergedGlobals,
    customFilters: mergedFilters,
    customGlobals: mergedGlobals,
    tests: mergedTests,
    extensions: { ...folded.extensions, ...config.extensions },
    dompurify: config.dompurify ?? folded.dompurify,
  });
};

const buildDefaultPipeOptions = (config: NunjucksConfig): PipeRenderStreamOptions => ({
  timeoutMs: config.streaming?.idleTimeout ?? 0,
  coalesceBytes: config.streaming?.coalesceBytes ?? 0,
  maxOutputSize: config.limits?.maxOutputSize ?? 0,
  contentType: config.streaming?.contentType ?? 'html',
  ide: config.ide ?? 'vscode',
  version: PACKAGE_VERSION,
  // WHY: thread the engine's dev mode — without it pipeRenderStream defaults to
  // production behavior (no ANSI fallback log, minimal error page) even though the
  // host explicitly asked for dev output.
  dev: config.dev ?? false,
});

/**
 * Builds the base engine factory — closes over shared config (filters, globals,
 * security, limits, loader path, etc.) and returns an engine whose per-call methods
 * only need the template + context + minimal overrides. The public `nunjucks(config)`
 * entry (in index.ts) is a thin wrapper over this; the split mirrors the betterAuth
 * createBetterAuth/betterAuth pattern, leaving room for a future init/context param
 * if a real purpose emerges.
 *
 * @param config - Shared engine configuration applied to every render call.
 * @returns The engine exposing Result-based render/renderToStream/pipeRenderStream.
 */
const createNunjucks = (config: NunjucksConfig = {}): NunjucksEngine => {
  const baseOptions = buildBaseOptions(config);
  const defaultPipeOptions = buildDefaultPipeOptions(config);

  // WHY: a non-empty custom loader chain REPLACES filesystem resolution (documented on
  // NunjucksConfig.loaders) — the chain is built once so every render shares it.
  const customLoader: TemplateLoader | null =
    config.loaders && config.loaders.length > 0 ? createLoaderChain(config.loaders) : null;

  // WHY: per-factory loader cache (closure-scoped, NOT module-global). The factory owns the loader lifecycle,
  // so two factories with the same views path get ISOLATED loader instances — no hidden cross-instance sharing.
  // Resolved per effective views (factory-time views OR a per-call override, e.g. Express's dirname(filePath)),
  // so a per-call views change creates/caches a loader within this factory only. GC'd when the factory is.
  const loaderCache = new Map<string, FileSystemLoader>();
  // WHY: JSON.stringify cache key — unambiguous identity for both a single path string and
  // a multi-root array (join with any separator could collide with that separator in a path).
  const loaderCacheKey = (views: string | string[]): string =>
    typeof views === 'string' ? views : JSON.stringify(views);
  const resolveLoader = (views: string | string[] | undefined): FileSystemLoader | null => {
    if (!views || (Array.isArray(views) && views.length === 0)) {
      return null;
    }
    const cacheKey = loaderCacheKey(views);
    const cached = loaderCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const loader = createFileSystemLoader(views);
    loaderCache.set(cacheKey, loader);
    return loader;
  };

  const buildCallOptions = (
    context: Record<string, unknown> | undefined,
    overrides: PerRenderOverrides | undefined
  ): RenderOptions => ({
    ...baseOptions,
    loader: customLoader ?? resolveLoader(overrides?.views ?? config.views),
    ...(context !== undefined && { context }),
    ...overrides,
  });

  return {
    render: (
      template: string,
      context?: Record<string, unknown>,
      overrides?: PerRenderOverrides
    ): Promise<Result<string, TemplateError>> =>
      renderInternal(template, buildCallOptions(context, overrides)),
    renderToStream: (
      template: string,
      context?: Record<string, unknown>,
      overrides?: PerRenderOverrides
    ): Promise<RenderStreamResult> =>
      renderToStreamInternal(template, buildCallOptions(context, overrides)),
    pipeRenderStream: (
      result: RenderStreamResult,
      sink: PipeSink,
      options?: PipeRenderStreamOptions
    ): Promise<void> =>
      pipeRenderStreamInternal(result, sink, { ...defaultPipeOptions, ...options }),
  };
};

export { createNunjucks };
