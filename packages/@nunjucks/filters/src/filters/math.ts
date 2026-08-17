import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import { err, ok, type Result } from '@nunjucks/lib';
import { createFilter, createFilterError, requireNumberError } from '../factory/index.ts';

export const abs = (value: unknown): Result<number, TemplateError> => {
  if (typeof value !== 'number') {
    return err(requireNumberError(value, ERROR_DEFINITIONS.MATH_FILTER));
  }
  return ok(Math.abs(value));
};

interface RoundOptions {
  value: unknown;
  precision?: number;
  method?: unknown;
}

// WHY: createFilter-wrapped so BOTH forms bind — positional `round(1.234, 2)` and
// kwargs `round(precision=2, method="ceil")`. A bare positional function would receive
// the compiler's keywords envelope as `precision` and render NaN.
const roundImpl = ({ value, precision, method }: RoundOptions): Result<number, TemplateError> => {
  if (typeof value !== 'number') {
    return err(requireNumberError(value, ERROR_DEFINITIONS.MATH_FILTER));
  }
  if (method !== undefined && method !== 'ceil' && method !== 'floor' && method !== 'round') {
    return err(
      createFilterError({
        errorDef: ERROR_DEFINITIONS.MATH_FILTER,
        params: { type: String(method) },
        subject: String(method),
        fallbackMessage: 'round method must be one of ceil, floor, round',
      })
    );
  }
  const factor = 10 ** (precision ?? 0);
  const rounder = method === 'ceil' ? Math.ceil : method === 'floor' ? Math.floor : Math.round;
  return ok(rounder(value * factor) / factor);
};

export const round = createFilter(['value', 'precision', 'method'], roundImpl);
