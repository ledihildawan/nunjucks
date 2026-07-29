import type { Environment } from '@nunjucks/shared';

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

interface CallerLocation {
  fileName: string;
  lineNumber?: number | null;
  columnNumber?: number | null;
}

interface SandboxOptions {
  allowlist?: string[];
  blocklistMode?: boolean;
  blockedContextKeys?: string[];
  environment?: Environment;
}

interface RenderConfig {
  dev?: boolean;
  autoescape?: boolean;
  undefined?: string;
  globals?: Record<string, unknown>;
  sandbox?: boolean;
  sandboxAllowlist?: readonly string[];
  sandboxMode?: string;
  sandboxEnvironment?: string;
  contextStrict?: boolean | 'error';
  production?: boolean;
  allowedGlobals?: readonly string[];
  executionTimeout?: number;
  env?: unknown;
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
