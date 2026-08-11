import { findDangerousValues } from './security/index.ts';
import type { BaseValidationError } from '@nunjucks/shared';

interface ContextValidationError extends BaseValidationError {
  code: string;
  dangerousPaths?: string[];
}

type ContextValidationResult =
  | { valid: true; errors: readonly [] }
  | { valid: false; errors: readonly [ContextValidationError, ...ContextValidationError[]] };

interface ContextValidatorConfig {
  strictMode?: boolean;
  scanContextValues?: boolean;
  blockedContextKeys?: readonly string[];
  allowedGlobals?: readonly string[];
}

const validateRenderContext = (context: unknown, config: ContextValidatorConfig): ContextValidationResult => {
  if (!(config.strictMode || config.scanContextValues)) {
    return { valid: true, errors: [] as const };
  }

  const dangerous = findDangerousValues(context, config.allowedGlobals);
  if (dangerous.length === 0) {
    return { valid: true, errors: [] as const };
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
