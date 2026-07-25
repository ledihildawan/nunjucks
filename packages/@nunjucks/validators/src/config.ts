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

export const validateConfig = (config: Config): ConfigValidationResult => {
  const errors: ConfigValidationError[] = [];

  if ((config.executionTimeout ?? 0) < 0) {
    errors.push({ code: 'INVALID_CONFIG', message: 'Invalid configuration: executionTimeout must be >= 0', subject: 'executionTimeout' });
  }

  if ((config.maxTemplateSize ?? 0) < 0) {
    errors.push({ code: 'INVALID_CONFIG', message: 'Invalid configuration: maxTemplateSize must be >= 0', subject: 'maxTemplateSize' });
  }

  if (config.sandboxEnvironment && !['auto', 'node', 'browser', 'deno'].includes(config.sandboxEnvironment)) {
    errors.push({ code: 'INVALID_CONFIG', message: 'Invalid configuration: sandboxEnvironment must be auto, node, browser, or deno', subject: 'sandboxEnvironment' });
  }

  if (config._customFilters) {
    for (const [name] of Object.entries(config._customFilters)) {
      const validation = validateFilterName(name);
      if (!validation.valid && validation.error) {
        errors.push(validation.error as ConfigValidationError);
      }
    }
  }

  if (config._customGlobals) {
    for (const [name] of Object.entries(config._customGlobals)) {
      const validation = validateGlobalName(name);
      if (!validation.valid && validation.error) {
        errors.push(validation.error as ConfigValidationError);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
