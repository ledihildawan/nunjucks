import { PACKAGE_VERSION } from './config/global.ts';
import type { NunjucksConfig, NunjucksEngine } from './config/nunjucks-config.ts';
import { createNunjucks } from './factory.ts';

// WHY: public API surface. `nunjucks(config)` is the single entry point (factory → engine) — a thin wrapper
// over the base `createNunjucks` (in factory.ts). The split mirrors betterAuth's createBetterAuth/betterAuth
// pattern: the base factory carries the implementation; this wrapper is the stable public name with room to
// gain an init/context param later if a real purpose emerges. The flat render/renderToStream/pipeRenderStream
// functions are engine-internal (used by the factory and core tests via relative imports) and intentionally
// NOT re-exported here. Advanced streaming adapters remain available for non-Express runtimes.
const nunjucks = (config: NunjucksConfig = {}): NunjucksEngine => createNunjucks(config);

export type { SourceFileReader, TemplateError } from '@nunjucks/error-formatter';
export { formatError } from '@nunjucks/error-formatter';
export type { Result } from '@nunjucks/lib';
export { createSandboxedContext } from '@nunjucks/runtime';
export type { GlobalConfig } from './config/global.ts';
export type {
  LimitsConfig,
  NunjucksConfig,
  NunjucksEngine,
  PerRenderOverrides,
  SecurityConfig,
  StreamingConfig,
} from './config/nunjucks-config.ts';
export type { NunjucksPlugin } from './plugin/index.ts';
export { foldPlugins } from './plugin/index.ts';
export type { PipeRenderStreamOptions, PipeSink } from './render/pipe-stream.ts';
export {
  isStreamTimeoutError,
  type StreamTimeoutError,
  toWebReadableStream,
  withStreamDeadline,
  withStreamTimeout,
} from './render/render-stream-adapters.ts';
export type { RenderStreamResult } from './render/render-types.ts';
export { createNunjucks, nunjucks, PACKAGE_VERSION };
