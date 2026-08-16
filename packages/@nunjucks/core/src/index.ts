import { PACKAGE_VERSION } from './config/global.ts';
import type { NunjucksConfig, NunjucksEngine } from './config/nunjucks-config.ts';
import { createNunjucks } from './factory.ts';

// WHY: public API surface. `nunjucks(config)` is the single entry point (factory → engine) — a thin wrapper
// over the base `createNunjucks` (in factory.ts). The barrel intentionally exports ONLY the factory, the
// version, error-formatting conveniences, and the types needed to author configs / annotate engine calls
// (API symmetry: every type appearing in an engine signature must be importable by consumers). The base
// factory, plugin folding, streaming adapters, and sandbox internals stay reachable via their owning
// modules for in-repo consumers but are not public contract.
const nunjucks = (config: NunjucksConfig = {}): NunjucksEngine => createNunjucks(config);

export type { SourceFileReader, TemplateError } from '@nunjucks/error-formatter';
export { formatError } from '@nunjucks/error-formatter';
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
