import { describe, test, expect } from 'bun:test';
import {
  batch, first, last, lengthFilter, list, random, reverse, slice, sum,
} from './array.ts';

describe('batch', () => {
  test('splits into groups', () => {
    expect(batch([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  test('fills last batch', () => {
    expect(batch([1, 2, 3, 4, 5], 2, 0)).toEqual([[1, 2], [3, 4], [5, 0]]);
  });
  test('even split', () => {
    expect(batch([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });
});

describe('first / last', () => {
  test('first returns element 0', () => {
    expect(first(['a', 'b', 'c'])).toBe('a');
  });
  test('last returns last element', () => {
    expect(last(['a', 'b', 'c'])).toBe('c');
  });
});

describe('lengthFilter', () => {
  test('array length', () => {
    expect(lengthFilter([1, 2, 3])).toBe(3);
  });
  test('string length', () => {
    expect(lengthFilter('hello')).toBe(5);
  });
  test('object key count', () => {
    expect(lengthFilter({ a: 1, b: 2 })).toBe(2);
  });
  test('map size', () => {
    expect(lengthFilter(new Map([['a', 1], ['b', 2]]))).toBe(2);
  });
  test('set size', () => {
    expect(lengthFilter(new Set([1, 2, 3]))).toBe(3);
  });
});

describe('list', () => {
  test('string to char array', () => {
    expect(list('abc')).toEqual(['a', 'b', 'c']);
  });
  test('object to pair array', () => {
    expect(list({ a: 1 })).toEqual([{ key: 'a', value: 1 }]);
  });
  test('array passthrough', () => {
    expect(list([1, 2])).toEqual([1, 2]);
  });
});

describe('reverse', () => {
  test('reverses array', () => {
    expect(reverse([1, 2, 3])).toEqual([3, 2, 1]);
  });
  test('reverses string', () => {
    expect(reverse('abc') as unknown as string).toBe('cba');
  });
});

describe('slice', () => {
  test('splits evenly', () => {
    expect(slice([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });
  test('handles remainder', () => {
    const r = slice([1, 2, 3, 4, 5], 2);
    expect(r).toHaveLength(2);
    expect(r.flat()).toHaveLength(5);
  });
});

describe('sum', () => {
  test('sums numbers', () => {
    expect(sum([1, 2, 3, 4])).toBe(10);
  });
  test('respects start value', () => {
    expect(sum([1, 2, 3], undefined, 10)).toBe(16);
  });
  test('sums by attribute', () => {
    expect(sum([{ price: 1 }, { price: 2 }], 'price')).toBe(3);
  });
});

describe('random', () => {
  test('returns an element from the array', () => {
    const arr = [1, 2, 3];
    const r = random(arr);
    expect(arr).toContain(r);
  });
});
