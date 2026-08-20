import { describe, expect, test } from 'bun:test';
import { ERROR_CODES } from '@nunjucks/error-catalog';
import { adjustColnoForNullValue } from './adjust-colno.ts';
import type { ColnoAdjustmentError } from './create-log-types.ts';

const NULL_ACCESS_MESSAGE = "Cannot read property 'name' on null 'user'";

const createAdjustableError = (
  overrides: Partial<ColnoAdjustmentError> = {}
): ColnoAdjustmentError => {
  const error: ColnoAdjustmentError = Object.assign(new Error(NULL_ACCESS_MESSAGE), {
    code: ERROR_CODES.NULL_VALUE,
    sourceContent: 'Hello {{ user.name }}',
    lineno: 0,
    colno: 9,
    lineBase: 'zero',
  } satisfies Pick<
    ColnoAdjustmentError,
    'code' | 'sourceContent' | 'lineno' | 'colno' | 'lineBase'
  >);
  return Object.assign(error, overrides);
};

describe('adjustColnoForNullValue — passthrough cases', () => {
  test('non-NULL_VALUE errors keep their column', () => {
    const error = createAdjustableError({ code: 'OTHER_CODE' });
    expect(adjustColnoForNullValue(error)).toBe(9);
  });

  test('missing source content keeps the column', () => {
    const error = createAdjustableError({ sourceContent: undefined });
    expect(adjustColnoForNullValue(error)).toBe(9);
  });

  test('missing lineno keeps the column', () => {
    const error = createAdjustableError({ lineno: null });
    expect(adjustColnoForNullValue(error)).toBe(9);
  });

  test('message without a null-parent suffix keeps the column', () => {
    const error = createAdjustableError({ message: 'plain failure without suffix' });
    expect(adjustColnoForNullValue(error)).toBe(9);
  });

  test('parent name absent from the error line keeps the column', () => {
    const error = createAdjustableError({ sourceContent: 'Hello {{ account.name }}' });
    expect(adjustColnoForNullValue(error)).toBe(9);
  });

  test('lineno past the end of source keeps the column', () => {
    const error = createAdjustableError({ lineno: 42 });
    expect(adjustColnoForNullValue(error)).toBe(9);
  });
});

describe('adjustColnoForNullValue — adjustment cases', () => {
  test('zero-based lineBase points at the parent member', () => {
    const error = createAdjustableError({ lineBase: 'zero', lineno: 0 });
    expect(adjustColnoForNullValue(error)).toBe('Hello {{ '.length);
  });

  test('one-based lineBase converts lineno and returns a one-based column', () => {
    const error = createAdjustableError({ lineBase: 'one', lineno: 1 });
    expect(adjustColnoForNullValue(error)).toBe('Hello {{ '.length + 1);
  });

  test('one-based lineno selects the correct line in multi-line source', () => {
    const error = createAdjustableError({
      sourceContent: 'first line\nsecond {{ user.name }}',
      lineBase: 'one',
      lineno: 2,
    });
    expect(adjustColnoForNullValue(error)).toBe('second {{ '.length + 1);
  });

  test('zero-based lineno selects the correct line in multi-line source', () => {
    const error = createAdjustableError({
      sourceContent: 'first line\nsecond {{ user.name }}',
      lineBase: 'zero',
      lineno: 1,
    });
    expect(adjustColnoForNullValue(error)).toBe('second {{ '.length);
  });
});
