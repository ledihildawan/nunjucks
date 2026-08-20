import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import { err, ok, type Result } from '@nunjucks/lib';
import { createFilter, createFilterError, requireNumberError } from '../factory/index.ts';

/** Returns the absolute value; non-numbers fail the numeric contract. */
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

/**
 * Rounds to `precision` digits with `ceil`/`floor`/`round`; positional
 * `round(1.234, 2)` and kwargs `round(precision=2, method="ceil")` both bind.
 */
export const round = createFilter(['value', 'precision', 'method'], roundImpl);

// WHY: numbers and numeric strings parse (upstream semantics — that is the filter's
// documented job), every other type is a catalogued contract error rather than a
// silent NaN-fallback, matching the strictness abs/round already enforce.
const isParseable = (value: unknown): value is number | string =>
  typeof value === 'number' || typeof value === 'string';

interface FloatOptions {
  value: unknown;
  default?: unknown;
}

const floatImpl = ({ value, default: fallback }: FloatOptions): Result<unknown, TemplateError> => {
  if (!isParseable(value)) {
    return err(requireNumberError(value, ERROR_DEFINITIONS.MATH_FILTER));
  }
  // WHY: number inputs skip the string round-trip — parseFloat(1.5) is 1.5 either
  // way, but NaN number inputs must fall back like unparseable strings do.
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return ok(Number.isNaN(parsed) ? fallback : parsed);
};

/**
 * Parses a number or numeric string to a float, substituting `default` when
 * the parse yields NaN; other input types fail the numeric contract.
 */
export const float = createFilter(['value', 'default'], floatImpl);

interface IntOptions {
  value: unknown;
  default?: unknown;
  base?: number;
}

const intImpl = ({
  value,
  default: fallback,
  base,
}: IntOptions): Result<unknown, TemplateError> => {
  if (!isParseable(value)) {
    return err(requireNumberError(value, ERROR_DEFINITIONS.MATH_FILTER));
  }
  // WHY: parseInt truncates number inputs toward zero (parseInt(1.7) === 1) —
  // Math.trunc reproduces that without the string round-trip.
  const parsed =
    typeof value === 'number'
      ? Math.trunc(value)
      : Number.parseInt(value, typeof base === 'number' ? base : 10);
  return ok(Number.isNaN(parsed) ? fallback : parsed);
};

/**
 * Parses a number or numeric string to an integer in `base` (default 10),
 * substituting `default` when the parse yields NaN; other input types fail
 * the numeric contract.
 */
export const int = createFilter(['value', 'default', 'base'], intImpl);
