import type { Environment, BaseValidationError } from '@nunjucks/shared';
import type { CallerLocation } from './caller-file.ts';
import type { SandboxOptions, Env, UndefinedMode } from '@nunjucks/runtime';
import type { SandboxMode } from '../config/global.ts';

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

interface RenderConfig {
  dev?: boolean;
  autoescape?: boolean;
  undefined?: UndefinedMode;
  globals?: Record<string, unknown>;
  sandbox?: boolean;
  sandboxAllowlist?: readonly string[];
  sandboxMode?: SandboxMode;
  sandboxEnvironment?: Environment;
  contextStrict?: boolean | 'error';
  allowedGlobals?: readonly string[];
  executionTimeout?: number;
  maxTemplateSize?: number;
  strictMode?: boolean;
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

export type { LoaderSource, ResolveResult, RenderValidationError, CallerLocation, Environment, SandboxOptions, RenderConfig, ValidationErrorRequest, CompileResult };
