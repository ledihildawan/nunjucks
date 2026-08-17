import { isNullish } from 'remeda';

/**
 * Coerces a value to its display string, substituting `defaultValue` for
 * `null`/`undefined` and `false` — the falsy-visible set from nunjucks'
 * string-filter semantics.
 */
const normalize = (value: unknown, defaultValue: string): string => {
  if (isNullish(value) || value === false) {
    return defaultValue;
  }
  return String(value);
};

export { normalize };
