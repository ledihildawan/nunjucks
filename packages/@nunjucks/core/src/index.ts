import { createNunjucks } from './factory.ts';
import type { NunjucksConfig, NunjucksEngine } from './config/nunjucks-config.ts';

// WHY: public API surface. `nunjucks(config)` is the single entry point (factory → engine) — a thin wrapper
// over the base `createNunjucks` (in factory.ts). The split mirrors betterAuth's createBetterAuth/betterAuth
// pattern: the base factory carries the implementation; this wrapper is the stable public name with room to
// gain an init/context param later if a real purpose emerges. The flat render/renderToStream/pipeRenderStream
// functions are engine-internal (used by the factory and core tests via relative imports) and intentionally
// NOT re-exported here. Advanced streaming adapters remain available for non-Express runtimes.
const nunjucks = (config: NunjucksConfig = {}): NunjucksEngine => createNunjucks(config);

export { nunjucks, createNunjucks };
export type { NunjucksConfig, SecurityConfig, LimitsConfig, StreamingConfig, PerRenderOverrides, NunjucksEngine } from './config/nunjucks-config.ts';
export { foldPlugins } from './plugin/index.ts';
export type { NunjucksPlugin } from './plugin/index.ts';
export type { RenderStreamResult } from './render/render-types.ts';
export type { PipeSink, PipeRenderStreamOptions } from './render/pipe-stream.ts';
export { toWebReadableStream, withStreamTimeout, withStreamDeadline, isStreamTimeoutError, type StreamTimeoutError } from './render/render-stream-adapters.ts';
export type { GlobalConfig } from './config/global.ts';
export type { Result } from '@nunjucks/lib';
export type { TemplateError } from '@nunjucks/log';
