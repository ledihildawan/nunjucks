import { describe, expect, test } from 'bun:test';
import { getOrElse, isErr, isOk } from '@nunjucks/lib';
import { first, last, lengthFilter, reverse, slice, sort, sum } from './array.ts';

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

  describe('lengthFilter', () => {
    test('returns the length of an array', () => {
      expect(getOrElse(lengthFilter([1, 2, 3, 4]), null)).toBe(4);
      expect(getOrElse(lengthFilter([]), null)).toBe(0);
    });

    test('returns the length of a string', () => {
      expect(getOrElse(lengthFilter('hello'), null)).toBe(5);
    });

    test('returns the number of own keys on a plain object', () => {
      expect(getOrElse(lengthFilter({ a: 1, b: 2, c: 3 }), null)).toBe(3);
      expect(getOrElse(lengthFilter({}), null)).toBe(0);
    });

    test('returns the size of a Map or Set', () => {
      expect(
        getOrElse(
          lengthFilter(
            new Map([
              ['a', 1],
              ['b', 2],
            ])
          ),
          null
        )
      ).toBe(2);
      expect(getOrElse(lengthFilter(new Set([1, 2, 3])), null)).toBe(3);
    });

    test('treats null, undefined, and false as an empty value', () => {
      expect(getOrElse(lengthFilter(null), null)).toBe(0);
      expect(getOrElse(lengthFilter(undefined), null)).toBe(0);
      expect(getOrElse(lengthFilter(false), null)).toBe(0);
    });

    test('returns an ok result', () => {
      expect(isOk(lengthFilter([1, 2]))).toBe(true);
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
});
