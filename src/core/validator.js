import { validateContext, scanTemplateForDangerousCode } from '../runtime/security.js';

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
      errors.push({
        code: 'DANGEROUS_TEMPLATE_CODE',
        message: `Template contains dangerous code: ${violations.map(v => v.message).join('; ')}`,
        violations
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
    return {
      valid: false,
      errors: [{
        code: err.code || 'SECURITY_VIOLATION',
        message: err.message
      }]
    };
  }
};

export const validateConfig = (config) => {
  const errors = [];

  if (config.executionTimeout < 0) {
    errors.push({ code: 'INVALID_CONFIG', message: 'executionTimeout must be >= 0' });
  }

  if (config.maxTemplateSize < 0) {
    errors.push({ code: 'INVALID_CONFIG', message: 'maxTemplateSize must be >= 0' });
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
