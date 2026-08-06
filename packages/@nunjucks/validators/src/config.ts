import { flatMap, keys, pipe } from 'remeda';
import { validateFilterName, validateGlobalName } from '@nunjucks/shared';

export interface ConfigValidationError {
  code: string;
  message: string;
  subject: string;
  type: string;
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
    ? [{ code: 'INVALID_CONFIG', message: 'Invalid configuration: executionTimeout must be >= 0', subject: 'executionTimeout', type: 'numeric' }]
    : []),
  ...((config.maxTemplateSize ?? 0) < 0
    ? [{ code: 'INVALID_CONFIG', message: 'Invalid configuration: maxTemplateSize must be >= 0', subject: 'maxTemplateSize', type: 'numeric' }]
    : []),
];

const validateSandboxEnv = (config: Config): ConfigValidationError[] =>
  config.sandboxEnvironment && !['auto', 'node', 'browser', 'deno'].includes(config.sandboxEnvironment)
    ? [{ code: 'INVALID_CONFIG', message: 'Invalid configuration: sandboxEnvironment must be auto, node, browser, or deno', subject: 'sandboxEnvironment', type: 'sandbox' }]
    : [];

const validateCustomFilters = (config: Config): ConfigValidationError[] => {
  if (!config._customFilters) { return []; }
  return pipe(
    keys(config._customFilters),
    flatMap((name) => {
      const validation = validateFilterName(name);
      if (!validation.valid && validation.error) {
        const { code, message, subject, type } = validation.error;
        return [{ code, message, subject, type }];
      }
      return [];
    })
  );
};

const validateCustomGlobals = (config: Config): ConfigValidationError[] => {
  if (!config._customGlobals) { return []; }
  return pipe(
    keys(config._customGlobals),
    flatMap((name) => {
      const validation = validateGlobalName(name);
      if (!validation.valid && validation.error) {
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
  return { valid: errors.length === 0, errors };
};
