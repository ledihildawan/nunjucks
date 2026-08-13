import { flatMap, keys, pipe } from 'remeda';
import { validateFilterName, validateGlobalName } from './reserved.ts';
import { isNonEmpty } from './is-non-empty.ts';
import { ok, err, isErr, type Result } from '@nunjucks/lib';
import type { Environment } from './security/index.ts';
import type { BaseValidationError } from '@nunjucks/shared';

export interface ConfigValidationError extends BaseValidationError {
  code: string;
  subject: string;
  type: string;
}

export type ConfigValidationResult = Result<void, readonly [ConfigValidationError, ...ConfigValidationError[]]>;

export interface Config {
  executionTimeout?: number;
  maxTemplateSize?: number;
  sandboxEnvironment?: Environment;
  // WHY: these are the USER-supplied names only (validated for reserved/dangerous). They are deliberately a
  // SEPARATE channel from the full merged filters/globals used at render time: the built-in defaults include
  // intentionally "dangerous-named" but safe-curated globals (Object/Array/Math via SAFE_BUILTINS), which would
  // false-positive if validated. The factory (core/src/factory.ts) maps its filters/globals into customFilters/
  // customGlobals so the user's names get checked without checking the trusted built-ins.
  customFilters?: Record<string, unknown>;
  customGlobals?: Record<string, unknown>;
}

const VALID_ENVIRONMENTS: ReadonlySet<Environment> = new Set(['auto', 'node', 'browser', 'deno']);

const validateNumericConfig = (config: Config): ConfigValidationError[] => [
  ...((config.executionTimeout ?? 0) < 0
    ? [{ code: 'INVALID_CONFIG', message: 'Invalid configuration: executionTimeout must be >= 0', subject: 'executionTimeout', type: 'numeric' }]
    : []),
  ...((config.maxTemplateSize ?? 0) < 0
    ? [{ code: 'INVALID_CONFIG', message: 'Invalid configuration: maxTemplateSize must be >= 0', subject: 'maxTemplateSize', type: 'numeric' }]
    : []),
];

const validateSandboxEnv = (config: Config): ConfigValidationError[] =>
  config.sandboxEnvironment !== undefined && !VALID_ENVIRONMENTS.has(config.sandboxEnvironment)
    ? [{ code: 'INVALID_CONFIG', message: `Invalid configuration: sandboxEnvironment must be one of ${[...VALID_ENVIRONMENTS].join(', ')}`, subject: 'sandboxEnvironment', type: 'sandbox' }]
    : [];

const validateCustomFilters = (config: Config): ConfigValidationError[] => {
  if (!config.customFilters) { return []; }
  return pipe(
    keys(config.customFilters),
    flatMap((name) => {
      const validation = validateFilterName(name);
      if (isErr(validation)) {
        const { code, message, subject, type } = validation.error;
        return [{ code, message, subject, type }];
      }
      return [];
    })
  );
};

const validateCustomGlobals = (config: Config): ConfigValidationError[] => {
  if (!config.customGlobals) { return []; }
  return pipe(
    keys(config.customGlobals),
    flatMap((name) => {
      const validation = validateGlobalName(name);
      if (isErr(validation)) {
        const { code, message, subject, type } = validation.error;
        return [{ code, message, subject, type }];
      }
      return [];
    })
  );
};

export const validateConfig = (config: Config): ConfigValidationResult => {
  const errors = [
    ...validateNumericConfig(config),
    ...validateSandboxEnv(config),
    ...validateCustomFilters(config),
    ...validateCustomGlobals(config),
  ];

  if (!isNonEmpty(errors)) {
    return ok(undefined);
  }
  const [first, ...rest] = errors;
  return err([first, ...rest] as const);
};
