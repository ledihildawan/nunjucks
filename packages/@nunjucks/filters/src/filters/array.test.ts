import { describe, test, expect } from 'bun:test';
import { first, last, lengthFilter, reverse, slice, sum, sort } from './array.ts';

describe('filters/array', () => {
  describe('first', () => {
    test('returns the first element of an array', () => {
      expect(first([1, 2, 3])).toBe(1);
    });

    test('returns undefined for an empty array', () => {
      expect(first([])).toBeUndefined();
    });

    test('throws when input is not an array', () => {
      expect(() => first('not an array')).toThrow();
      expect(() => first(null)).toThrow();
      expect(() => first({ 0: 'a' })).toThrow();
    });
  });

  describe('last', () => {
    test('returns the last element of an array', () => {
      expect(last([1, 2, 3])).toBe(3);
    });

    test('returns undefined for an empty array', () => {
      expect(last([])).toBeUndefined();
    });

    test('throws when input is not an array', () => {
      expect(() => last(42)).toThrow();
    });
  });

  describe('lengthFilter', () => {
    test('returns the length of an array', () => {
      expect(lengthFilter([1, 2, 3, 4])).toBe(4);
      expect(lengthFilter([])).toBe(0);
    });

    test('returns the length of a string', () => {
      expect(lengthFilter('hello')).toBe(5);
    });

    test('returns the number of own keys on a plain object', () => {
      expect(lengthFilter({ a: 1, b: 2, c: 3 })).toBe(3);
      expect(lengthFilter({})).toBe(0);
    });

    test('returns the size of a Map or Set', () => {
      expect(lengthFilter(new Map([['a', 1], ['b', 2]]))).toBe(2);
      expect(lengthFilter(new Set([1, 2, 3]))).toBe(3);
    });

    test('treats null, undefined, and false as an empty value', () => {
      expect(lengthFilter(null)).toBe(0);
      expect(lengthFilter(undefined)).toBe(0);
      expect(lengthFilter(false)).toBe(0);
    });
  });

  describe('reverse', () => {
    test('reverses an array', () => {
      expect(reverse([1, 2, 3])).toEqual([3, 2, 1]);
    });

    test('reverses a string', () => {
      expect(reverse('abc')).toBe('cba');
    });

    test('does not mutate the original input', () => {
      const arr = [1, 2, 3];
      reverse(arr);
      expect(arr).toEqual([1, 2, 3]);
    });

    test('throws when input is neither a string nor an array', () => {
      expect(() => reverse(123)).toThrow();
      expect(() => reverse(null)).toThrow();
    });
  });

  describe('slice', () => {
    test('divides an array into N roughly equal slices', () => {
      const result = slice([1, 2, 3, 4, 5, 6], 3) as number[][];
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual([1, 2]);
      expect(result[1]).toEqual([3, 4]);
      expect(result[2]).toEqual([5, 6]);
    });

    test('distributes leftover elements to earlier slices', () => {
      const result = slice([1, 2, 3, 4, 5, 6, 7], 3) as number[][];
      expect(result[0]).toEqual([1, 2, 3]);
      expect(result[1]).toEqual([4, 5]);
      expect(result[2]).toEqual([6, 7]);
    });

    test('pads trailing slices with the fillWith value when leftover', () => {
      const result = slice([1, 2, 3, 4], 3, 'x') as Array<Array<number | string>>;
      expect(result[0]).toEqual([1, 2]);
      expect(result[1]).toEqual([3, 'x']);
      expect(result[2]).toEqual([4, 'x']);
    });

    test('pads trailing empty slices when N exceeds the array length', () => {
      const result = slice([1, 2, 3], 5, null) as Array<Array<number | null>>;
      expect(result).toHaveLength(5);
      expect(result[0]).toEqual([1]);
      expect(result[1]).toEqual([2]);
      expect(result[2]).toEqual([3]);
      expect(result[3]).toEqual([null]);
      expect(result[4]).toEqual([null]);
    });

    test('throws when N is zero or negative', () => {
      expect(() => slice([1, 2], 0)).toThrow();
      expect(() => slice([1, 2], -1)).toThrow();
    });

    test('throws when input is not an array', () => {
      expect(() => slice('not array', 2)).toThrow();
    });
  });

  describe('sum', () => {
    test('sums an array of numbers', () => {
      expect(sum([1, 2, 3, 4])).toBe(10);
    });

    test('returns the start value when the array is empty', () => {
      expect(sum([], undefined, 5)).toBe(5);
    });

    test('sums values of an object when an attribute name is provided', () => {
      const items = [
        { type: 'a', val: 1 },
        { type: 'b', val: 2 },
        { type: 'a', val: 3 },
      ];
      const total = sum(items, 'val');
      expect(total).toBe(6);
    });

    test('throws when input is a plain object without an attribute', () => {
      expect(() => sum({ a: 1, b: 2 })).toThrow();
    });

    test('sums a named attribute across array items', () => {
      const items = [{ price: 1 }, { price: 2 }, { price: 3 }];
      expect(sum(items, 'price')).toBe(6);
    });

    test('throws when input is neither an array nor a plain object', () => {
      expect(() => sum('nope')).toThrow();
      expect(() => sum(42)).toThrow();
    });
  });

  describe('sort', () => {
    test('sorts an array of numbers ascending', () => {
      expect(sort([3, 1, 2])).toEqual([1, 2, 3]);
    });

    test('sorts an array of strings alphabetically', () => {
      expect(sort(['banana', 'apple', 'cherry'])).toEqual(['apple', 'banana', 'cherry']);
    });

    test('sorts in reverse when reverse is true', () => {
      expect(sort([1, 2, 3], true)).toEqual([3, 2, 1]);
    });

    test('is case-insensitive by default for strings', () => {
      expect(sort(['banana', 'Apple', 'cherry'])).toEqual(['Apple', 'banana', 'cherry']);
    });

    test('respects case_sensitive=true', () => {
      const result = sort(['banana', 'Apple', 'cherry'], false, true) as string[];
      const sortedCopy = ['banana', 'Apple', 'cherry'].sort();
      expect(result).toEqual(sortedCopy);
    });

    test('sorts by an attribute when attribute is provided', () => {
      const items = [{ age: 30 }, { age: 10 }, { age: 20 }];
      expect(sort(items, false, false, 'age')).toEqual([{ age: 10 }, { age: 20 }, { age: 30 }]);
    });

    test('does not mutate the input array', () => {
      const arr = [3, 1, 2];
      sort(arr);
      expect(arr).toEqual([3, 1, 2]);
    });

    test('throws when input is not an array', () => {
      expect(() => sort('not array')).toThrow();
    });
  });
});