import { describe, expect, test } from 'bun:test';
import { getOrElse, isErr, isOk } from '@nunjucks/lib';
import { batch, first, last, length, list, random, reverse, slice, sort, sum } from './array.ts';

describe('filters/array', () => {
  describe('first', () => {
    test('returns the first element of an array', () => {
      const result = first([1, 2, 3]);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toBe(1);
    });

    test('returns undefined for an empty array', () => {
      const result = first([]);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toBeUndefined();
    });

    test('returns error when input is not an array', () => {
      const stringInputResult = first('not an array');
      expect(isErr(stringInputResult)).toBe(true);
      const nullInputResult = first(null);
      expect(isErr(nullInputResult)).toBe(true);
      const objectInputResult = first({ 0: 'a' });
      expect(isErr(objectInputResult)).toBe(true);
    });
  });

  describe('last', () => {
    test('returns the last element of an array', () => {
      const result = last([1, 2, 3]);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toBe(3);
    });

    test('returns undefined for an empty array', () => {
      const result = last([]);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toBeUndefined();
    });

    test('returns error when input is not an array', () => {
      const result = last(42);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('length', () => {
    test('returns the length of an array', () => {
      expect(getOrElse(length([1, 2, 3, 4]), null)).toBe(4);
      expect(getOrElse(length([]), null)).toBe(0);
    });

    test('returns the length of a string', () => {
      expect(getOrElse(length('hello'), null)).toBe(5);
    });

    test('returns the number of own keys on a plain object', () => {
      expect(getOrElse(length({ a: 1, b: 2, c: 3 }), null)).toBe(3);
      expect(getOrElse(length({}), null)).toBe(0);
    });

    test('returns the size of a Map or Set', () => {
      expect(
        getOrElse(
          length(
            new Map([
              ['a', 1],
              ['b', 2],
            ])
          ),
          null
        )
      ).toBe(2);
      expect(getOrElse(length(new Set([1, 2, 3])), null)).toBe(3);
    });

    test('undefined reports 0 (missing values count as empty)', () => {
      expect(getOrElse(length(undefined), null)).toBe(0);
    });

    // WHY: old pin (0 for number/boolean/null) captured the audit-flagged silent-flip
    // with a false "nunjucks parity" comment — the port's strictness precedent (first/last)
    // errors on non-countable inputs instead of coercing to 0.
    test('number, boolean, and null inputs fail the countable contract', () => {
      expect(isErr(length(3))).toBe(true);
      expect(isErr(length(true))).toBe(true);
      expect(isErr(length(null))).toBe(true);
    });

    test('returns an ok result', () => {
      expect(isOk(length([1, 2]))).toBe(true);
    });
  });

  describe('reverse', () => {
    test('reverses an array', () => {
      const result = reverse([1, 2, 3]);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([3, 2, 1]);
    });

    test('reverses a string', () => {
      const result = reverse('abc');
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toBe('cba');
    });

    test('does not mutate the original input', () => {
      const arr = [1, 2, 3];
      reverse(arr);
      expect(arr).toEqual([1, 2, 3]);
    });

    test('returns error when input is neither a string nor an array', () => {
      const numericInputResult = reverse(123);
      expect(isErr(numericInputResult)).toBe(true);
      const nullInputResult = reverse(null);
      expect(isErr(nullInputResult)).toBe(true);
    });
  });

  describe('slice', () => {
    test('divides an array into N roughly equal slices', () => {
      const result = slice([1, 2, 3, 4, 5, 6], 3);
      expect(isOk(result)).toBe(true);
      const value = getOrElse(result, null!);
      expect(value).toHaveLength(3);
      expect(value[0]).toEqual([1, 2]);
      expect(value[1]).toEqual([3, 4]);
      expect(value[2]).toEqual([5, 6]);
    });

    test('distributes leftover elements to earlier slices', () => {
      const result = slice([1, 2, 3, 4, 5, 6, 7], 3);
      expect(isOk(result)).toBe(true);
      const value = getOrElse(result, null!);
      expect(value[0]).toEqual([1, 2, 3]);
      expect(value[1]).toEqual([4, 5]);
      expect(value[2]).toEqual([6, 7]);
    });

    test('pads trailing slices with the fillWith value when leftover', () => {
      const result = slice([1, 2, 3, 4], 3, 'x');
      expect(isOk(result)).toBe(true);
      const value = getOrElse(result, null!);
      expect(value[0]).toEqual([1, 2]);
      expect(value[1]).toEqual([3, 'x']);
      expect(value[2]).toEqual([4, 'x']);
    });

    test('pads trailing empty slices when N exceeds the array length', () => {
      const result = slice([1, 2, 3], 5, null);
      expect(isOk(result)).toBe(true);
      const value = getOrElse(result, null!);
      expect(value).toHaveLength(5);
      expect(value[0]).toEqual([1]);
      expect(value[1]).toEqual([2]);
      expect(value[2]).toEqual([3]);
      expect(value[3]).toEqual([null]);
      expect(value[4]).toEqual([null]);
    });

    test('returns error when N is zero or negative', () => {
      const zeroCountResult = slice([1, 2], 0);
      expect(isErr(zeroCountResult)).toBe(true);
      const negativeCountResult = slice([1, 2], -1);
      expect(isErr(negativeCountResult)).toBe(true);
    });

    test('returns error when input is not an array', () => {
      const result = slice('not array', 2);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('sum', () => {
    test('sums an array of numbers', () => {
      const result = sum([1, 2, 3, 4]);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toBe(10);
    });

    test('returns the start value when the array is empty', () => {
      const result = sum([], undefined, 5);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toBe(5);
    });

    test('sums values of an object when an attribute name is provided', () => {
      const items = [
        { type: 'a', val: 1 },
        { type: 'b', val: 2 },
        { type: 'a', val: 3 },
      ];
      const result = sum(items, 'val');
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toBe(6);
    });

    test('returns error when input is a plain object without an attribute', () => {
      const result = sum({ a: 1, b: 2 });
      expect(isErr(result)).toBe(true);
    });

    test('sums a named attribute across array items', () => {
      const items = [{ price: 1 }, { price: 2 }, { price: 3 }];
      const result = sum(items, 'price');
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toBe(6);
    });

    test('sums a dotted attribute path across array items', () => {
      // WHY: regression — validation rejected dotted attrs as nonexistent, and the
      // value read used the literal 'user.age' key instead of the resolved path.
      const items = [{ user: { age: 30 } }, { user: { age: 20 } }];
      const result = sum(items, 'user.age');
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toBe(50);
    });

    test('returns error when input is neither an array nor a plain object', () => {
      const stringInputResult = sum('nope');
      expect(isErr(stringInputResult)).toBe(true);
      const numericInputResult = sum(42);
      expect(isErr(numericInputResult)).toBe(true);
    });
  });

  describe('sort', () => {
    test('sorts an array of numbers ascending', () => {
      const result = sort([3, 1, 2]);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([1, 2, 3]);
    });

    test('sorts an array of strings alphabetically', () => {
      const result = sort(['banana', 'apple', 'cherry']);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual(['apple', 'banana', 'cherry']);
    });

    test('sorts in reverse when reverse is true', () => {
      const result = sort([1, 2, 3], true);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([3, 2, 1]);
    });

    test('is case-insensitive by default for strings', () => {
      const result = sort(['banana', 'Apple', 'cherry']);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual(['Apple', 'banana', 'cherry']);
    });

    test('respects case_sensitive=true', () => {
      const result = sort(['banana', 'Apple', 'cherry'], false, true);
      expect(isOk(result)).toBe(true);
      const sortedCopy = ['banana', 'Apple', 'cherry'].sort();
      expect(getOrElse(result, null)).toEqual(sortedCopy);
    });

    test('sorts by an attribute when attribute is provided', () => {
      const items = [{ age: 30 }, { age: 10 }, { age: 20 }];
      const result = sort(items, false, false, 'age');
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([{ age: 10 }, { age: 20 }, { age: 30 }]);
    });

    test('sorts by a dotted attribute path', () => {
      // WHY: regression — the comparator already resolved 'user.age' via
      // getAttrGetter, but validation rejected dotted attrs as nonexistent.
      const items = [{ user: { age: 30 } }, { user: { age: 10 } }, { user: { age: 20 } }];
      const result = sort(items, false, false, 'user.age');
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([
        { user: { age: 10 } },
        { user: { age: 20 } },
        { user: { age: 30 } },
      ]);
    });

    test('does not mutate the input array', () => {
      const arr = [3, 1, 2];
      sort(arr);
      expect(arr).toEqual([3, 1, 2]);
    });

    test('returns error when input is not an array', () => {
      const result = sort('not array');
      expect(isErr(result)).toBe(true);
    });

    test('coerces string "true" kwargs to boolean true', () => {
      const result = sort(['banana', 'Apple', 'cherry'], false, 'true');
      expect(isOk(result)).toBe(true);
      const sortedCopy = ['banana', 'Apple', 'cherry'].sort();
      expect(getOrElse(result, null)).toEqual(sortedCopy);
    });

    test('treats non-"true" string kwargs as false', () => {
      const result = sort(['banana', 'Apple', 'cherry'], false, 'yes');
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual(['Apple', 'banana', 'cherry']);
    });

    test('coerces string reverse flag when sorting by attribute positionally', () => {
      const items = [{ age: 30 }, { age: 10 }, { age: 20 }];
      const result = sort(items, 'age', 'true');
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([{ age: 30 }, { age: 20 }, { age: 10 }]);
    });

    test('binds reversed, caseSens, and attr from keyword arguments', () => {
      const items = [{ age: 30 }, { age: 10 }, { age: 20 }];
      const result = sort(items, { keywords: true, attr: 'age', reversed: true });
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([{ age: 30 }, { age: 20 }, { age: 10 }]);
    });
  });

  describe('batch', () => {
    test('splits an array into fixed-size rows', () => {
      const result = batch([1, 2, 3, 4, 5], 2);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([[1, 2], [3, 4], [5]]);
    });

    test('pads the final short row with fillWith', () => {
      const result = batch([1, 2, 3, 4, 5], 2, 'x');
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([
        [1, 2],
        [3, 4],
        [5, 'x'],
      ]);
    });

    test('a falsy fillWith opts out of padding', () => {
      const result = batch([1, 2, 3], 2, null);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([[1, 2], [3]]);
    });

    test('returns an empty array for an empty input', () => {
      const result = batch([], 3);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([]);
    });

    test('returns error when linecount is not a positive integer', () => {
      const zeroResult = batch([1, 2], 0);
      expect(isErr(zeroResult)).toBe(true);
      const fractionalResult = batch([1, 2], 1.5);
      expect(isErr(fractionalResult)).toBe(true);
      const negativeResult = batch([1, 2], -1);
      expect(isErr(negativeResult)).toBe(true);
    });

    test('returns error when input is not an array', () => {
      const result = batch('not array', 2);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('list', () => {
    test('splits a string into characters', () => {
      const result = list('abc');
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual(['a', 'b', 'c']);
    });

    test('passes arrays through', () => {
      const result = list([1, 2, 3]);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([1, 2, 3]);
    });

    test('converts a plain object to key/value entries', () => {
      const result = list({ b: 2, a: 1 });
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([
        { key: 'b', value: 2 },
        { key: 'a', value: 1 },
      ]);
    });

    test('materializes other iterables', () => {
      const setResult = list(new Set([1, 2]));
      expect(isOk(setResult)).toBe(true);
      expect(getOrElse(setResult, null)).toEqual([1, 2]);
      const mapResult = list(new Map([['a', 1]]));
      expect(getOrElse(mapResult, null)).toEqual([['a', 1]]);
    });

    test('returns error for non-iterable input', () => {
      const numberResult = list(42);
      expect(isErr(numberResult)).toBe(true);
      const nullResult = list(null);
      expect(isErr(nullResult)).toBe(true);
      const boolResult = list(true);
      expect(isErr(boolResult)).toBe(true);
    });
  });

  describe('random', () => {
    test('returns a member of the array', () => {
      const values = [1, 2, 3];
      for (let i = 0; i < 20; i++) {
        expect(values).toContain(getOrElse(random(values), null) as number);
      }
    });

    test('returns a character of a string', () => {
      const text = 'abc';
      for (let i = 0; i < 20; i++) {
        expect([...text]).toContain(getOrElse(random(text), null) as string);
      }
    });

    test('returns undefined for an empty array', () => {
      const result = random([]);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toBeUndefined();
    });

    test('returns error when input is neither array nor string', () => {
      const numberResult = random(42);
      expect(isErr(numberResult)).toBe(true);
      const nullResult = random(null);
      expect(isErr(nullResult)).toBe(true);
    });
  });
});
