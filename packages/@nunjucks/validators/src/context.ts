import { err, ok, type Result } from '@nunjucks/lib';
import type { BaseValidationError } from '@nunjucks/shared';
import { findDangerousValues } from './security/context-security.ts';

export interface ContextValidationError extends BaseValidationError {
  code: string;
  dangerousPaths?: string[];
}

export type ContextValidationResult = Result<
  void,
  readonly [ContextValidationError, ...ContextValidationError[]]
>;

export interface ContextValidatorConfig {
  strictMode?: boolean;
  scanContextValues?: boolean;
  blockedContextKeys?: readonly string[];
  allowedGlobals?: readonly string[];
}

const validateRenderContext = (
  context: unknown,
  config: ContextValidatorConfig
): ContextValidationResult => {
  if (!(config.strictMode || config.scanContextValues)) {
    return ok(undefined);
  }

  const dangerous = findDangerousValues(context, config.allowedGlobals);
  if (dangerous.length === 0) {
    return ok(undefined);
  }

  const [first] = dangerous;
  return err([
    {
      code: 'DANGEROUS_CONTEXT_VALUES',
      message: `Context contains unsafe values: ${dangerous.join(', ')}`,
      subject: first,
      dangerousPaths: dangerous,
    },
  ] as const);
};

const findContextDangerousValues = (
  context: unknown,
  config: { allowedGlobals?: readonly string[] } = {}
): string[] => {
  if (!context || typeof context !== 'object') {
    return [];
  }
  return findDangerousValues(context, config.allowedGlobals);
};

export { findContextDangerousValues, validateRenderContext };
