import { describe, expect, test } from 'bun:test';
import { getOrElse, isErr, isOk } from '@nunjucks/lib';
import { reject, rejectattr, select, selectattr } from './select.ts';

describe('filters/select', () => {
  describe('select', () => {
    test('defaults to the truthy test when no test name is given', () => {
      const result = select([0, 1, '', 'a', null]);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([1, 'a']);
    });

    test('filters with a builtin test', () => {
      const result = select([1, 2, 3, 4], 'even');
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([2, 4]);
    });

    test('passes the second argument through to parameterized tests', () => {
      const result = select([2, 3, 4, 6], 'divisibleby', 3);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([3, 6]);
    });

    test('resolves custom tests through the render context env hook', () => {
      const context = {
        env: {
          getTest: (name: string) =>
            name === 'big'
              ? (value: unknown) => typeof value === 'number' && value > 10
              : undefined,
        },
      };
      const result = select.call(context, [5, 20, 50], 'big');
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([20, 50]);
    });

    test('returns error when input is not an array', () => {
      const result = select('not array');
      expect(isErr(result)).toBe(true);
    });
  });

  describe('reject', () => {
    test('keeps items failing the named test', () => {
      const result = reject([1, 2, 3, 4], 'even');
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([1, 3]);
    });

    test('defaults to the truthy test', () => {
      const result = reject([0, 1, '', 'a']);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([0, '']);
    });
  });

  describe('selectattr', () => {
    test('keeps items whose attribute resolves truthy', () => {
      const items = [{ n: 1, on: true }, { n: 2 }, { n: 3, on: false }];
      const result = selectattr(items, 'on');
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([{ n: 1, on: true }]);
    });

    test('resolves dotted attribute paths', () => {
      const items = [{ user: { admin: true } }, { user: {} }, { user: { admin: false } }];
      const result = selectattr(items, 'user.admin');
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([{ user: { admin: true } }]);
    });

    test('returns error when input is not an array', () => {
      const result = selectattr('not array', 'on');
      expect(isErr(result)).toBe(true);
    });

    test('returns error when the attribute name is missing', () => {
      const result = selectattr([{ on: true }]);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('rejectattr', () => {
    test('keeps items whose attribute resolves falsy', () => {
      const items = [{ n: 1, on: true }, { n: 2 }, { n: 3, on: false }];
      const result = rejectattr(items, 'on');
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([{ n: 2 }, { n: 3, on: false }]);
    });

    test('returns error when input is not an array', () => {
      const result = rejectattr(42, 'on');
      expect(isErr(result)).toBe(true);
    });
  });
});
