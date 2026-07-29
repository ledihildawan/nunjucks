import { flatMap, pipe } from 'remeda';
import { validateFilterName, validateGlobalName } from '@nunjucks/shared';

export interface ConfigValidationError {
  code: string;
  message: string;
  subject: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
}

export interface Config {
  executionTimeout?: number;
  maxTemplateSize?: number;
  sandboxEnvironment?: string;
  _customFilters?: Record<string, unknown>;
  _customGlobals?: Record<string, unknown>;
}

const validateNumericConfig = (config: Config): ConfigValidationError[] => [
  ...((config.executionTimeout ?? 0) < 0
    ? [{ code: 'INVALID_CONFIG', message: 'Invalid configuration: executionTimeout must be >= 0', subject: 'executionTimeout' }]
    : []),
  ...((config.maxTemplateSize ?? 0) < 0
    ? [{ code: 'INVALID_CONFIG', message: 'Invalid configuration: maxTemplateSize must be >= 0', subject: 'maxTemplateSize' }]
    : []),
];

const validateSandboxEnv = (config: Config): ConfigValidationError[] =>
  config.sandboxEnvironment && !['auto', 'node', 'browser', 'deno'].includes(config.sandboxEnvironment)
    ? [{ code: 'INVALID_CONFIG', message: 'Invalid configuration: sandboxEnvironment must be auto, node, browser, or deno', subject: 'sandboxEnvironment' }]
    : [];

const validateCustomFilters = (config: Config): ConfigValidationError[] => {
  if (!config._customFilters) { return []; }
  return pipe(
    Object.keys(config._customFilters),
    flatMap((name) => {
      const validation = validateFilterName(name);
      return !validation.valid && validation.error
        ? [validation.error as ConfigValidationError]
        : [];
    })
  );
};

const validateCustomGlobals = (config: Config): ConfigValidationError[] => {
  if (!config._customGlobals) { return []; }
  return pipe(
    Object.keys(config._customGlobals),
    flatMap((name) => {
      const validation = validateGlobalName(name);
      return !validation.valid && validation.error
        ? [validation.error as ConfigValidationError]
        : [];
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
  return { valid: errors.length === 0, errors };
};
