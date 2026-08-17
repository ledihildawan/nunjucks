import { ERROR_CODES } from '@nunjucks/error-catalog';
import { err, ok, type Result } from '@nunjucks/lib';
import type { BaseValidationError } from '@nunjucks/shared';
import { findDangerousValues } from './security/context-security.ts';

interface ContextValidationError extends BaseValidationError {
  code: string;
  dangerousPaths?: string[];
}

type ContextValidationResult = Result<
  void,
  readonly [ContextValidationError, ...ContextValidationError[]]
>;

interface ContextValidatorConfig {
  strictMode?: boolean;
  scanContextValues?: boolean;
  blockedContextKeys?: readonly string[];
  allowedGlobals?: readonly string[];
}

/**
 * Validates a render context before rendering, returning `Err` with the
 * `DANGEROUS_CONTEXT_VALUES` code and the offending dotted paths when the
 * strict-mode/value-scan gates are enabled and dangerous values are found.
 * Returns `Ok` immediately when neither `strictMode` nor `scanContextValues`
 * is set — scanning is opt-in, not free.
 */
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
      code: ERROR_CODES.DANGEROUS_CONTEXT_VALUES,
      message: `Context contains unsafe values: ${dangerous.join(', ')}`,
      subject: first,
      dangerousPaths: dangerous,
    },
  ] as const);
};

/** Finds dangerous value paths in a context; non-object contexts yield `[]`. */
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
