import type { TemplateError } from '@nunjucks/error-formatter';
import type { Result } from '@nunjucks/lib';
import type { FileSystemLoader } from '@nunjucks/loaders';
import type { Env, SandboxOptions, UndefinedMode } from '@nunjucks/runtime';
import type { BaseValidationError } from '@nunjucks/shared';
import type { Environment } from '@nunjucks/validators/security';
import type { SandboxMode } from '../config/global.ts';
import type { CallerLocation } from './caller-file.ts';

interface LoaderSource {
  src: string;
  path: string;
  noCache?: boolean;
}

interface ResolveResult {
  templateSource: string;
  templatePath: string | null;
}

interface RenderValidationError extends BaseValidationError {
  dangerousPaths?: string[];
}

// WHY: RenderConfig is the INTERNAL flat form (plus diagnostics: callerFrames, env, loader). The relationship
// across the four config types: NunjucksConfig (public, nested) → factory.buildBaseOptions flattens it →
// render.setupRenderConfig merges GlobalConfig defaults + the flat bag → RenderConfig (this). RenderOptions
// (render.ts) is the loose input shape (Partial<GlobalConfig> + context) used by the internal render(). Only
// NunjucksConfig is public; the other three are engine-internal.
interface RenderConfig {
  dev?: boolean;
  autoescape?: boolean;
  undefined?: UndefinedMode;
  trimBlocks?: boolean;
  lstripBlocks?: boolean;
  ide?: string;
  version?: string;
  globals?: Record<string, unknown>;
  sandbox?: boolean;
  sandboxAllowlist?: readonly string[];
  sandboxMode?: SandboxMode;
  sandboxEnvironment?: Environment;
  contextStrict?: boolean | 'error';
  allowedGlobals?: readonly string[];
  executionTimeout?: number;
  maxOutputSize?: number;
  maxTemplateSize?: number;
  strictMode?: boolean;
  scanContextValues?: boolean;
  blockedContextKeys?: readonly string[];
  env?: Env | null;
  views?: string | null;
  templatePath?: string | null;
  jsCaller?: string | null;
  jsCallerErrorLine?: number | null;
  jsCallerErrorCol?: number | null;
  callerFile?: string | null;
  callerLocation?: CallerLocation | null;
  callerFrames?: readonly CallerLocation[] | null;
  streamErrorRecovery?: boolean;
  loader?: FileSystemLoader | null;
  customFilters?: Record<string, unknown>;
  customGlobals?: Record<string, unknown>;
  filters?: Record<string, (...args: unknown[]) => unknown>;
  tests?: Record<string, (...args: unknown[]) => unknown>;
  extensions?: Readonly<Record<string, unknown>>;
  environment?: string | null;
}

interface ValidationErrorRequest {
  validationError: RenderValidationError;
  stamps: Record<string, unknown>;
  config: RenderConfig;
  templateSource: string | null;
  context: unknown;
}

interface CompileResult {
  code: string;
}

interface PreparedTemplate {
  readonly code: string;
  readonly sandboxedCtx: Record<string, unknown>;
  readonly warningsCollector: import('@nunjucks/error-formatter').TemplateWarning[];
  readonly templateName: string;
  readonly resolvedConfig: RenderConfig;
  readonly templateSource: string;
  readonly context: Record<string, unknown>;
  readonly streamContentType: 'html' | 'json' | 'text';
  readonly version?: string;
}

interface RenderOptions extends Partial<import('../config/global.ts').GlobalConfig> {
  context?: Record<string, unknown>;
  streamContentType?: 'html' | 'json' | 'text';
}

// WHY: streaming-render error contract (two-pass), expressed as the standard Result shape from @nunjucks/lib.
// Pre-stream failures (compile/validate/load) arrive as `err(error)` so the consumer can still render an error
// page — response headers are not yet sent. Once streaming starts, mid-stream runtime errors CANNOT render an
// error page; the AsyncGenerator (`ok(generator)`) throws instead and the consumer aborts + logs. The SAME
// TemplateError flows through both windows — only the delivery differs (Result vs throw), so no separate error
// type is needed.
type RenderStreamResult = Result<AsyncGenerator<string, unknown, unknown>, TemplateError>;

export type {
  CallerLocation,
  CompileResult,
  Environment,
  LoaderSource,
  PreparedTemplate,
  RenderConfig,
  RenderOptions,
  RenderStreamResult,
  RenderValidationError,
  ResolveResult,
  SandboxOptions,
  ValidationErrorRequest,
};
