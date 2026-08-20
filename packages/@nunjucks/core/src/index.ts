import { PACKAGE_VERSION } from './config/global.ts';
import type { NunjucksConfig, NunjucksEngine } from './config/nunjucks-config.ts';
import { createNunjucks } from './factory.ts';

// WHY: public API surface. `nunjucks(config)` is the single entry point (factory → engine) — a thin wrapper
// over the base `createNunjucks` (in factory.ts). The barrel intentionally exports ONLY the factory, the
// version, error-formatting conveniences, and the types needed to author configs / annotate engine calls
// (API symmetry: every type appearing in an engine signature must be importable by consumers). The base
// factory, plugin folding, streaming adapters, and sandbox internals stay reachable via their owning
// modules for in-repo consumers but are not public contract.
/**
 * Creates a configured Nunjucks engine — the single public entry point of `@nunjucks/core`.
 *
 * @param config - Engine configuration. `views` selects template roots (multi-root,
 *   first match wins) or `loaders` supplies a custom `TemplateLoader[]` chain that
 *   replaces filesystem resolution; `filters`/`globals`/`tests`/`extensions` register
 *   callables; `security`/`limits`/`streaming`/`cache` tune the render pipeline.
 * @returns Engine exposing `render` (Result-wrapped string), `renderToStream`
 *   (two-pass chunked stream), and `pipeRenderStream` (HTTP sink adapter).
 * @example
 * ```ts
 * const engine = nunjucks({ views: './views' });
 * const result = await engine.render('hello.njk', { name: 'Ada' });
 * ```
 */
const nunjucks = (config: NunjucksConfig = {}): NunjucksEngine => createNunjucks(config);

export type { SourceFileReader, TemplateError } from '@nunjucks/error-formatter';
export { formatError } from '@nunjucks/error-formatter/format';
export type { Result } from '@nunjucks/lib';
export type {
  ContentType,
  LimitsConfig,
  NunjucksConfig,
  NunjucksEngine,
  PerRenderOverrides,
  SecurityConfig,
  StreamingConfig,
} from './config/nunjucks-config.ts';
export type { NunjucksPlugin } from './plugin/index.ts';
export type { PipeRenderStreamOptions, PipeSink } from './render/pipe-stream.ts';
export type { RenderStreamResult } from './render/render-types.ts';
export { nunjucks, PACKAGE_VERSION };
