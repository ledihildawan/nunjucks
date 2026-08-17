import type { TemplateError } from '@nunjucks/error-formatter';
import { err, ok, type Result } from '@nunjucks/lib';
import { entries, isPlainObject, join, map, pipe } from 'remeda';
import { createFilterError, isArray } from '../factory/index.ts';

// WHY: type predicate (not plain boolean) so Array.prototype.every narrows the input
// array and resolveQueryPairs needs no cast after the guard.
const isQueryPair = (value: unknown): value is [string | number, unknown] =>
  isArray(value) &&
  value.length >= 2 &&
  (typeof value[0] === 'string' || typeof value[0] === 'number');

const unsupportedQueryError = (input: unknown): TemplateError =>
  createFilterError({
    errorDef: undefined,
    params: { type: typeof input },
    subject: typeof input,
    fallbackMessage: 'urlencode: expected string, array of [key, value] pairs, or object',
  });

const resolveQueryPairs = (
  input: unknown
): Result<[string | number, unknown][], TemplateError> => {
  if (isArray(input)) {
    if (!input.every(isQueryPair)) {
      return err(unsupportedQueryError(input));
    }
    return ok(input);
  }
  if (isPlainObject(input)) {
    return ok(entries(input));
  }
  return err(unsupportedQueryError(input));
};

const encodeQueryPair = ([key, val]: [string | number, unknown]): string =>
  `${encodeURIComponent(String(key))}=${encodeURIComponent(String(val))}`;

const urlencode = (queryParameters: unknown): Result<string, TemplateError> => {
  if (typeof queryParameters === 'string') {
    return ok(encodeURIComponent(queryParameters));
  }
  const pairsResult = resolveQueryPairs(queryParameters);
  if (!pairsResult.ok) {
    return err(pairsResult.error);
  }
  return ok(
    pipe(
      pairsResult.value,
      map(encodeQueryPair),
      join('&')
    )
  );
};

export { urlencode };
