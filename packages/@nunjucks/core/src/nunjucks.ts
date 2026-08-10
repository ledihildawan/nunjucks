import { render as renderInternal, renderToStream as renderToStreamInternal } from './render/render.ts';
import { pipeRenderStream as pipeRenderStreamInternal } from './render/pipe-stream.ts';
import { foldPlugins } from './plugin/index.ts';
import type { NunjucksConfig, NunjucksEngine, PerRenderOverrides } from './config/nunjucks-config.ts';
import type { RenderStreamResult } from './render/render-types.ts';
import type { PipeSink, PipeRenderStreamOptions } from './render/pipe-stream.ts';
import type { Result } from '@nunjucks/shared';
import type { TemplateError } from '@nunjucks/log';

// WHY: strip keys whose value is undefined so they do NOT override the engine's built-in defaults when the
// base bag is spread into the internal render options ({ ...defaults, ...options }). A present-undefined key
// (e.g. sandbox: undefined from an absent security group) would clobber the default; removing it lets the
// default survive. null is preserved (it is meaningful for blockedContextKeys etc.).
const compact = <T extends Record<string, unknown>>(record: T): Partial<T> =>
  Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as Partial<T>;

// WHY: flatten the nested NunjucksConfig into the flat options bag the internal render pipeline expects, after
// folding plugins. Layering order (lowest → highest precedence): built-in defaults (applied inside render) →
// plugin filters/globals/tests/extensions → user's direct filters/globals/tests/extensions. Security/limits/
// streaming groups are flattened 1:1 to their existing flat keys.
const buildBaseOptions = (config: NunjucksConfig): Record<string, unknown> => {
  const folded = foldPlugins(config.plugins);
  return compact({
    dev: config.dev,
    autoescape: config.autoescape,
    undefined: config.undefined,
    trimBlocks: config.trimBlocks,
    lstripBlocks: config.lstripBlocks,
    views: config.views,
    sandbox: config.security?.sandbox,
    sandboxMode: config.security?.sandboxMode,
    sandboxAllowlist: config.security?.sandboxAllowlist,
    sandboxEnvironment: config.security?.sandboxEnvironment,
    blockedContextKeys: config.security?.blockedContextKeys,
    contextStrict: config.security?.contextStrict,
    scanContextValues: config.security?.scanContextValues,
    strictMode: config.security?.strictMode,
    executionTimeout: config.limits?.executionTimeout,
    maxTemplateSize: config.limits?.maxTemplateSize,
    maxOutputSize: config.limits?.maxOutputSize,
    streamErrorRecovery: config.streaming?.errorRecovery,
    streamContentType: config.streaming?.contentType,
    filters: { ...folded.filters, ...config.filters },
    globals: { ...folded.globals, ...config.globals },
    tests: { ...folded.tests, ...config.tests },
    extensions: { ...folded.extensions, ...config.extensions },
    dompurify: config.dompurify ?? folded.dompurify,
  });
};

const buildDefaultPipeOptions = (config: NunjucksConfig): PipeRenderStreamOptions => ({
  timeoutMs: config.streaming?.idleTimeout ?? 0,
  coalesceBytes: config.streaming?.coalesceBytes ?? 0,
  maxOutputSize: config.limits?.maxOutputSize ?? 0,
  contentType: config.streaming?.contentType ?? 'html',
});

// WHY: the factory closes over shared config (filters, globals, security, limits, loader path, etc.) and
// returns an engine whose per-call methods only need the template + context + minimal overrides. This is the
// betterAuth-style entry point replacing the flat render(template, bigOptionsBag) API.
const nunjucks = (config: NunjucksConfig = {}): NunjucksEngine => {
  const baseOptions = buildBaseOptions(config);
  const defaultPipeOptions = buildDefaultPipeOptions(config);

  const buildCallOptions = (context: Record<string, unknown> | undefined, overrides: PerRenderOverrides | undefined): Record<string, unknown> => ({
    ...baseOptions,
    ...(context !== undefined && { context }),
    ...overrides,
  });

  return {
    render: (template: string, context?: Record<string, unknown>, overrides?: PerRenderOverrides): Promise<Result<string, TemplateError>> =>
      renderInternal(template, buildCallOptions(context, overrides)),
    renderToStream: (template: string, context?: Record<string, unknown>, overrides?: PerRenderOverrides): Promise<RenderStreamResult> =>
      renderToStreamInternal(template, buildCallOptions(context, overrides)),
    pipeRenderStream: (result: RenderStreamResult, sink: PipeSink, options?: PipeRenderStreamOptions): Promise<void> =>
      pipeRenderStreamInternal(result, sink, { ...defaultPipeOptions, ...options }),
  };
};

export { nunjucks };
