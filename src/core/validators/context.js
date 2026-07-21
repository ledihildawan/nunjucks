import { validateContext, findDangerousValues } from '@nunjucks/runtime/security';

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
      errorObj.errors[0].subject = err.dangerousPaths[0];
      errorObj.errors[0].dangerousPaths = err.dangerousPaths;
    }
    return errorObj;
  }
};

export const findContextDangerousValues = (context, config = {}) => {
  if (!context || typeof context !== 'object') return [];
  return findDangerousValues(context, config.allowedGlobals);
};
