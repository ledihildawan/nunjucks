import { ERROR_CODES, normalizeLineBase } from '@nunjucks/error-catalog';
import type { ColnoAdjustmentError } from './create-log-types.ts';

/**
 * Repoints a `NULL_VALUE` error's column at the parent object in the source line
 * instead of the raw null position, so the source-trace caret lands on the
 * parent expression (the `user` in `user.name`, not the null and not the
 * accessed member).
 *
 * Non-`NULL_VALUE` errors, missing source/line, or messages without a
 * parseable "on null/undefined 'parent'" suffix pass `err.colno` through
 * unchanged.
 *
 * @param err - The branded error carrying `code`, `sourceContent`, `lineno`,
 *   `colno`, and `lineBase`.
 * @returns The adjusted column, interpreted under the error's `lineBase`.
 */
const adjustColnoForNullValue = (err: ColnoAdjustmentError): number | null | undefined => {
  if (err.code !== ERROR_CODES.NULL_VALUE || !err.sourceContent || err.lineno == null) {
    return err.colno;
  }
  const parentMatch = err.message.match(/on (?:null|undefined) '([^']+)'$/u);
  if (!parentMatch?.[1]) {
    return err.colno;
  }
  // WHY: normalizeLineBase so an absent/junk lineBase defaults to 'zero' exactly like
  // resolveTraceLineBase — the raw `=== 'zero'` check used to fall through to the 'one'
  // branch for undefined, producing off-by-one columns for non-branded errors.
  const zeroBased = normalizeLineBase(err.lineBase) === 'zero';
  const lines = err.sourceContent.split('\n');
  const lineIndex = zeroBased ? err.lineno : Math.max(0, err.lineno - 1);
  const errorLine = lines[lineIndex];
  if (!errorLine) {
    return err.colno;
  }
  const parentIdx = errorLine.indexOf(parentMatch[1]);
  if (parentIdx < 0) {
    return err.colno;
  }
  return zeroBased ? parentIdx : parentIdx + 1;
};

export { adjustColnoForNullValue };
