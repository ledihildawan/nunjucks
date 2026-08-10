// WHY: public API surface. `nunjucks()` is the single entry point (factory → engine). The flat
// render/renderToStream/pipeRenderStream functions are engine-internal now (used by the factory and core
// tests via relative imports); they are intentionally NOT re-exported here. Advanced streaming adapters
// (toWebReadableStream, withStreamTimeout/Deadline) remain available for non-Express runtimes.
export { nunjucks } from './nunjucks.ts';
export type { NunjucksConfig, SecurityConfig, LimitsConfig, StreamingConfig, PerRenderOverrides, NunjucksEngine } from './config/nunjucks-config.ts';
export { foldPlugins } from './plugin/index.ts';
export type { NunjucksPlugin } from './plugin/index.ts';
export type { RenderStreamResult } from './render/render-types.ts';
export type { PipeSink, PipeRenderStreamOptions } from './render/pipe-stream.ts';
export { toWebReadableStream, withStreamTimeout, withStreamDeadline, isStreamTimeoutError, type StreamTimeoutError } from './render/render-stream-adapters.ts';
export type { GlobalConfig } from './config/global.ts';
export type { Result } from '@nunjucks/shared';
export type { TemplateError } from '@nunjucks/log';
