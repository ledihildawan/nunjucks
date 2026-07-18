import { validateContext, scanTemplateForDangerousCode } from '../runtime/security.js';
import { validateFilterName, validateGlobalName } from '../config/reserved.js';

export const validateTemplate = (template, config) => {
  const errors = [];

  if (config.maxTemplateSize > 0) {
    const size = typeof template === 'string' ? template.length : 0;
    if (size > config.maxTemplateSize) {
      errors.push({
        code: 'TEMPLATE_SIZE_EXCEEDED',
        message: `Template exceeds maximum size of ${config.maxTemplateSize} bytes`
      });
    }
  }

  if (config.strictMode || config.whitelistStrict) {
    const violations = scanTemplateForDangerousCode(template);
    if (violations.length > 0) {
      const first = violations[0];
      errors.push({
        code: 'DANGEROUS_TEMPLATE_CODE',
        message: `Template contains dangerous code: ${violations.map(v => v.message).join('; ')}`,
        violations,
        lineno: first.line,
        colno: first.col
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

export const validateRenderContext = (context, config) => {
  if (!config.strictMode && !config.scanContextValues) {
    return { valid: true, errors: [] };
  }

  try {
    validateContext(context, {
      allowedKeys: config.allowedContextKeys,
      blockedKeys: config.blockedContextKeys,
      scanValues: config.scanContextValues
    });
    return { valid: true, errors: [] };
  } catch (err) {
    const errorObj = {
      valid: false,
      errors: [{
        code: err.code || 'SECURITY_VIOLATION',
        message: err.message
      }]
    };
    if (err.dangerousPaths) {
      errorObj.errors[0].dangerousPaths = err.dangerousPaths;
    }
    return errorObj;
  }
};

export const validateConfig = (config) => {
  const errors = [];

  if (config.executionTimeout < 0) {
    errors.push({ code: 'INVALID_CONFIG', message: 'executionTimeout must be >= 0', subject: 'executionTimeout' });
  }

  if (config.maxTemplateSize < 0) {
    errors.push({ code: 'INVALID_CONFIG', message: 'maxTemplateSize must be >= 0', subject: 'maxTemplateSize' });
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
