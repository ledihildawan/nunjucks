import type { Environment, CallerLocation } from '@nunjucks/shared';
import type { SandboxOptions, Env } from '@nunjucks/runtime';

interface LoaderSource {
  src: string;
  path: string;
  noCache?: boolean;
}

interface ResolveResult {
  templateSource: string;
  templatePath: string | null;
}

interface ValidationError {
  message: string;
  code?: string;
  subject?: string;
  lineno?: number;
  colno?: number;
  dangerousPaths?: string[];
}

interface RenderConfig {
  dev?: boolean;
  autoescape?: boolean;
  undefined?: string;
  globals?: Record<string, unknown>;
  sandbox?: boolean;
  sandboxAllowlist?: readonly string[];
  sandboxMode?: string;
  sandboxEnvironment?: Environment;
  contextStrict?: boolean | 'error';
  allowedGlobals?: readonly string[];
  executionTimeout?: number;
  maxTemplateSize?: number;
  strictMode?: boolean;
  whitelistStrict?: boolean;
  scanContextValues?: boolean;
  blockedContextKeys?: readonly string[];
  env?: Env | null;
  templatePath?: string | null;
  jsCaller?: string | null;
  jsCallerErrorLine?: number | null;
  jsCallerErrorCol?: number | null;
  _callerFile?: string | null;
  _callerLocation?: CallerLocation | null;
  _customFilters?: Record<string, unknown>;
  _customGlobals?: Record<string, unknown>;
  filters?: Record<string, (...args: unknown[]) => unknown>;
  tests?: Record<string, (...args: unknown[]) => unknown>;
  [key: string]: unknown;
}

interface ValidationErrorRequest {
  validationError: ValidationError;
  stamps: Record<string, unknown>;
  config: RenderConfig;
  templateSource: string | null;
  context: unknown;
}

interface CompileResult {
  code: string;
}

export type { LoaderSource, ResolveResult, ValidationError, CallerLocation, Environment, SandboxOptions, RenderConfig, ValidationErrorRequest, CompileResult };
