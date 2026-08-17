import type { TemplateError } from '@nunjucks/error-formatter';
import type { Result } from '@nunjucks/lib';
import type { TemplateLoader } from '@nunjucks/loaders';
import type { UndefinedMode } from '@nunjucks/shared';
import type { ContentType, DomPurifyConfig } from '@nunjucks/shared';
import type { NunjucksPlugin } from '../plugin/plugin.ts';
import type { PipeRenderStreamOptions, PipeSink } from '../render/pipe-stream.ts';
import type { RenderStreamResult } from '../render/render-types.ts';
import type { SandboxEnvironment, SandboxMode } from './global.ts';

// WHY: filters/globals/tests/extensions are user-supplied and inherently dynamic (any signature). Modeling them
// as `Record<string, unknown>` matches the established GlobalConfig pattern and avoids contravariance friction
// (a `(value: string) => string` filter is not assignable to `(...args: unknown[]) => unknown`). The internal
// render pipeline casts to the callable shape at the call site.
export type ExtensionMap = Readonly<Record<string, unknown>>;

interface SecurityConfig {
  readonly sandbox?: boolean;
  readonly sandboxMode?: SandboxMode;
  readonly sandboxAllowlist?: readonly string[];
  readonly sandboxEnvironment?: SandboxEnvironment;
  readonly blockedContextKeys?: readonly string[];
  readonly allowedGlobals?: readonly string[];
  readonly contextStrict?: boolean | 'error';
  readonly scanContextValues?: boolean;
  readonly strictMode?: boolean;
}

interface LimitsConfig {
  readonly executionTimeout?: number;
  readonly maxTemplateSize?: number;
  readonly maxOutputSize?: number;
}

interface StreamingConfig {
  readonly errorRecovery?: boolean;
  readonly contentType?: ContentType;
  readonly idleTimeout?: number;
  readonly coalesceBytes?: number;
}

// WHY: compiled-code cache. Keys carry the source CONTENT hash, so a rewritten file
// lands on a fresh key on the next render — stale output is structurally impossible
// and no watcher is required. `templates: false` restores always-recompile behavior.
interface CacheConfig {
  readonly templates?: boolean;
  readonly maxEntries?: number;
}

/**
 * Engine configuration consumed by the `nunjucks()` factory. Every field is
 * optional; unset fields fall back to safe defaults (autoescape on, filesystem
 * resolution from `views`, in-memory compiled-template cache).
 *
 * Template sources: set `views` (filesystem roots, first match wins) **or**
 * `loaders` (custom chain that replaces filesystem resolution entirely).
 */
interface NunjucksConfig {
  readonly dev?: boolean;
  // WHY: multi-root lookup mirrors createFileSystemLoader's searchPaths contract —
  // templates resolve from the first root that has them.
  readonly views?: string | string[];
  // WHY: custom loaders REPLACE filesystem resolution entirely (first-match-wins chain);
  // `views` is ignored when a non-empty chain is supplied — pass createFileSystemLoader(paths)
  // inside the array to combine custom sources with the filesystem.
  readonly loaders?: readonly TemplateLoader[];
  readonly autoescape?: boolean;
  readonly undefined?: UndefinedMode;
  readonly trimBlocks?: boolean;
  readonly lstripBlocks?: boolean;
  readonly ide?: string;
  readonly security?: SecurityConfig;
  readonly limits?: LimitsConfig;
  readonly streaming?: StreamingConfig;
  readonly cache?: CacheConfig;
  readonly filters?: ExtensionMap;
  readonly globals?: ExtensionMap;
  readonly tests?: ExtensionMap;
  readonly extensions?: ExtensionMap;
  readonly dompurify?: DomPurifyConfig;
  readonly plugins?: readonly NunjucksPlugin[];
}

interface PerRenderOverrides {
  readonly views?: string | string[];
  readonly templatePath?: string | null;
  readonly executionTimeout?: number;
  readonly streamContentType?: ContentType;
}

// WHY: render/renderToStream/pipeRenderStream are public framework-contract entry points.
// render/renderToStream share the established (template, context, overrides) engine contract
// (subject + payload + optional config); pipeRenderStream keeps its (result, sink, options)
// shape so all three engine methods read uniformly as (subject, target, optional-config).
interface NunjucksEngine {
  /**
   * Renders a template to a complete string.
   *
   * @param template - Template name resolved via `views`/`loaders`, or inline
   *   source when no matching file exists.
   * @param context - Template variables.
   * @param overrides - Per-render overrides (views, timeout, content type).
   * @returns Result string, or a `TemplateError` (`err`) covering parse,
   *   compile, load, security, and render-phase failures.
   */
  render(
    template: string,
    context?: Record<string, unknown>,
    overrides?: PerRenderOverrides
  ): Promise<Result<string, TemplateError>>;
  /**
   * Renders a template as a two-pass chunked stream (validation pass, then
   * streamed output).
   *
   * @param template - Template name or inline source (see {@link render}).
   * @param context - Template variables.
   * @param overrides - Per-render overrides.
   * @returns Stream result whose chunks are consumed via its async iterator;
   *   pre-stream failures surface before the first chunk, mid-stream failures
   *   abort iteration (or render inline markers when error recovery is on).
   */
  renderToStream(
    template: string,
    context?: Record<string, unknown>,
    overrides?: PerRenderOverrides
  ): Promise<RenderStreamResult>;
  /**
   * Pipes a {@link renderToStream} result into an HTTP-style sink.
   *
   * @param result - Stream result to drain.
   * @param sink - Sink implementing `status`/`setHeader`/`write`/`end`.
   * @param options - Sink behavior (error hook, headers, content type).
   */
  pipeRenderStream(
    result: RenderStreamResult,
    sink: PipeSink,
    options?: PipeRenderStreamOptions
  ): Promise<void>;
}

export type {
  CacheConfig,
  ContentType,
  LimitsConfig,
  NunjucksConfig,
  NunjucksEngine,
  PerRenderOverrides,
  SecurityConfig,
  StreamingConfig,
};
