import type { Environment, BaseValidationError } from '@nunjucks/shared';
import type { CallerLocation } from './caller-file.ts';
import type { SandboxOptions, Env, UndefinedMode } from '@nunjucks/runtime';
import type { SandboxMode } from '../config/global.ts';
import type { TemplateError } from '@nunjucks/log';
import type { FileSystemLoader } from '@nunjucks/loaders';

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

// WHY: streaming-render error contract (two-pass). Pre-stream failures (compile/validate/load) arrive as `{ ok: false, error }` so the consumer can still render an error page — response headers are not yet sent. Once streaming starts, mid-stream runtime errors CANNOT render an error page; the AsyncGenerator throws instead and the consumer aborts + logs. The SAME TemplateError flows through both windows — only the delivery differs (Result vs throw), so no separate error type is needed.
type RenderStreamResult =
  | { readonly ok: false; readonly error: TemplateError }
  | { readonly ok: true; readonly stream: AsyncGenerator<string> };

export type { LoaderSource, ResolveResult, RenderValidationError, CallerLocation, Environment, SandboxOptions, RenderConfig, ValidationErrorRequest, CompileResult, RenderStreamResult };
