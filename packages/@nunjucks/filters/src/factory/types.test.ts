import { describe, expect, test } from 'bun:test';
import { isArray, isSafeString } from './types.ts';
import { markSafe } from '@nunjucks/lib';

describe('isArray', () => {
  type IsArrayCase = {
    readonly label: string;
    readonly input: unknown;
    readonly expected: boolean;
  };
  const isArrayCases: readonly IsArrayCase[] = [
    { label: 'an empty array', input: [], expected: true },
    { label: 'a populated array of numbers', input: [1, 2, 3], expected: true },
    { label: 'a mixed-type array', input: [1, 'a', null], expected: true },
    { label: 'a nested array', input: [[1, 2], [3]], expected: true },
    { label: 'a plain string (iterable but not an array)', input: 'abc', expected: false },
    { label: 'a number', input: 42, expected: false },
    { label: 'a boolean', input: true, expected: false },
    { label: 'a plain object', input: { key: 'value' }, expected: false },
    { label: 'null', input: null, expected: false },
    { label: 'undefined', input: undefined, expected: false },
  ];

  isArrayCases.forEach(({ label, input, expected }) => {
    test(`returns ${expected} for ${label}`, () => {
      expect(isArray(input)).toBe(expected);
    });
  });

  test('narrows the value to unknown[] inside a truthy branch', () => {
    const value: unknown = [1, 2, 3];
    if (isArray(value)) {
      expect(value.length).toBe(3);
      expect(value[1]).toBe(2);
    } else {
      expect.unreachable('should have narrowed to an array');
    }
  });
});

describe('isSafeString (re-exported from @nunjucks/runtime)', () => {
  test('identifies a marked-safe string as a SafeString', () => {
    expect(isSafeString(markSafe('safe-content'))).toBe(true);
  });

  type NonSafeCase = { readonly label: string; readonly input: unknown };
  const nonSafeCases: readonly NonSafeCase[] = [
    { label: 'a plain string', input: 'plain' },
    { label: 'an empty string', input: '' },
    { label: 'a number', input: 42 },
    { label: 'a plain object without a val property', input: { key: 'value' } },
    { label: 'an array', input: ['a', 'b'] },
    { label: 'null', input: null },
    { label: 'undefined', input: undefined },
    { label: 'false', input: false },
  ];

  nonSafeCases.forEach(({ label, input }) => {
    test(`returns false for ${label}`, () => {
      expect(isSafeString(input)).toBe(false);
    });
  });

  test('narrows to SafeString inside a truthy branch, exposing val/toString/valueOf', () => {
    const value: unknown = markSafe('safe');
    if (isSafeString(value)) {
      expect(value.toString()).toBe('safe');
      expect(value.valueOf()).toBe('safe');
      expect(value.val).toBe('safe');
    } else {
      expect.unreachable('should have narrowed to a SafeString');
    }
  });
});
