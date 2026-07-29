import { findDangerousValues } from '@nunjucks/shared';

interface ContextValidationError {
  code: string;
  message: string;
  subject?: string;
  dangerousPaths?: string[];
}

interface ContextValidationResult {
  valid: boolean;
  errors: ContextValidationError[];
}

interface ContextValidatorConfig {
  strictMode?: boolean;
  scanContextValues?: boolean;
  allowedContextKeys?: readonly string[];
  blockedContextKeys?: readonly string[];
  allowedGlobals?: readonly string[];
}

const validateRenderContext = (context: unknown, config: ContextValidatorConfig): ContextValidationResult => {
  if (!(config.strictMode || config.scanContextValues)) {
    return { valid: true, errors: [] };
  }

  const dangerous = findDangerousValues(context, config.allowedGlobals);
  if (dangerous.length === 0) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: [{
      code: 'DANGEROUS_CONTEXT_VALUES',
      message: `Context contains unsafe values: ${dangerous.join(', ')}`,
      subject: dangerous[0],
      dangerousPaths: dangerous
    }]
  };
};

const findContextDangerousValues = (context: unknown, config: { allowedGlobals?: readonly string[] } = {}): string[] => {
  if (!context || typeof context !== 'object') { return []; }
  return findDangerousValues(context, config.allowedGlobals);
};

export { validateRenderContext, findContextDangerousValues };
export type { ContextValidationError, ContextValidationResult, ContextValidatorConfig };
