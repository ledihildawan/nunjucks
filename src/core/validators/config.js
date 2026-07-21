import { validateFilterName, validateGlobalName } from '../../config/reserved.js';

export const validateConfig = (config) => {
  const errors = [];

  if (config.executionTimeout < 0) {
    errors.push({ code: 'INVALID_CONFIG', message: 'executionTimeout must be >= 0', subject: 'executionTimeout' });
  }

  if (config.maxTemplateSize < 0) {
    errors.push({ code: 'INVALID_CONFIG', message: 'maxTemplateSize must be >= 0', subject: 'maxTemplateSize' });
  }

  if (config.sandboxEnvironment && !['auto', 'node', 'browser', 'deno'].includes(config.sandboxEnvironment)) {
    errors.push({ code: 'INVALID_CONFIG', message: 'sandboxEnvironment must be auto, node, browser, or deno', subject: 'sandboxEnvironment' });
  }

  if (config._customFilters) {
    for (const [name] of Object.entries(config._customFilters)) {
      const validation = validateFilterName(name);
      if (!validation.valid) {
        errors.push({ ...validation.error });
      }
    }
  }

  if (config._customGlobals) {
    for (const [name] of Object.entries(config._customGlobals)) {
      const validation = validateGlobalName(name);
      if (!validation.valid) {
        errors.push({ ...validation.error });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
