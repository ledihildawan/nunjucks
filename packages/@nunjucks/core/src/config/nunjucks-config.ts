import type { TemplateError } from '@nunjucks/error-formatter';
import type { Result } from '@nunjucks/lib';
import type { TemplateLoader } from '@nunjucks/loaders';
import type { UndefinedMode } from '@nunjucks/runtime';
import type { DomPurifyConfig } from '@nunjucks/shared';
import type { NunjucksPlugin } from '../plugin/plugin.ts';
import type { PipeRenderStreamOptions, PipeSink } from '../render/pipe-stream.ts';
import type { RenderStreamResult } from '../render/render-types.ts';
import type { SandboxEnvironment, SandboxMode } from './global.ts';

type ContentType = 'html' | 'json' | 'text';
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

// WHY: render/renderToStream are public framework-contract entry points. The (template, context, overrides)
// shape is the established template-engine contract (subject + payload + optional config) which Rule 4 exempts
// as a "Fixed Framework / Engine Contract". The factory owns all other config; per-call overrides stay minimal.
interface NunjucksEngine {
  render(
    template: string,
    context?: Record<string, unknown>,
    overrides?: PerRenderOverrides
  ): Promise<Result<string, TemplateError>>;
  renderToStream(
    template: string,
    context?: Record<string, unknown>,
    overrides?: PerRenderOverrides
  ): Promise<RenderStreamResult>;
  pipeRenderStream(
    result: RenderStreamResult,
    sink: PipeSink,
    options?: PipeRenderStreamOptions
  ): Promise<void>;
}

export type {
  ContentType,
  LimitsConfig,
  NunjucksConfig,
  NunjucksEngine,
  PerRenderOverrides,
  SecurityConfig,
  StreamingConfig,
};
