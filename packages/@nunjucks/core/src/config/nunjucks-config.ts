import type { UndefinedMode } from '@nunjucks/runtime';
import type { DomPurifyConfig, Result } from '@nunjucks/shared';
import type { TemplateError } from '@nunjucks/log';
import type { SandboxMode, SandboxEnvironment } from './global.ts';
import type { NunjucksPlugin } from '../plugin/plugin.ts';
import type { RenderStreamResult } from '../render/render-types.ts';
import type { PipeSink, PipeRenderStreamOptions } from '../render/pipe-stream.ts';

type ContentType = 'html' | 'json' | 'text';
// WHY: filters/globals/tests/extensions are user-supplied and inherently dynamic (any signature). Modeling them
// as `Record<string, unknown>` matches the established GlobalConfig pattern and avoids contravariance friction
// (a `(value: string) => string` filter is not assignable to `(...args: unknown[]) => unknown`). The internal
// render pipeline casts to the callable shape at the call site.
type ExtensionMap = Readonly<Record<string, unknown>>;

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
  readonly views?: string;
  readonly autoescape?: boolean;
  readonly undefined?: UndefinedMode;
  readonly trimBlocks?: boolean;
  readonly lstripBlocks?: boolean;
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
  readonly views?: string;
  readonly templatePath?: string | null;
  readonly executionTimeout?: number;
  readonly streamContentType?: ContentType;
}

// WHY: render/renderToStream are public framework-contract entry points. The (template, context, overrides)
// shape is the established template-engine contract (subject + payload + optional config) which Rule 4 exempts
// as a "Fixed Framework / Engine Contract". The factory owns all other config; per-call overrides stay minimal.
interface NunjucksEngine {
  render(template: string, context?: Record<string, unknown>, overrides?: PerRenderOverrides): Promise<Result<string, TemplateError>>;
  renderToStream(template: string, context?: Record<string, unknown>, overrides?: PerRenderOverrides): Promise<RenderStreamResult>;
  pipeRenderStream(result: RenderStreamResult, sink: PipeSink, options?: PipeRenderStreamOptions): Promise<void>;
}

export type { NunjucksConfig, SecurityConfig, LimitsConfig, StreamingConfig, PerRenderOverrides, NunjucksEngine, ContentType };
