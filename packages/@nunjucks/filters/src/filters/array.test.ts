import { describe, test, expect } from 'bun:test';
import {
  first, last, lengthFilter, reverse, slice, sum,
  sort, reject, select,
} from './array.ts';

describe('first', () => {
  test('returns first element', () => {
    expect(first(['a', 'b', 'c'])).toBe('a');
  });
});

describe('last', () => {
  test('returns last element', () => {
    expect(last(['a', 'b', 'c'])).toBe('c');
  });
});

describe('lengthFilter', () => {
  test('returns array length', () => {
    expect(lengthFilter(['a', 'b', 'c'])).toBe(3);
  });
  test('returns string length', () => {
    expect(lengthFilter('hello')).toBe(5);
  });
  test('returns 0 for null', () => {
    expect(lengthFilter(null)).toBe(0);
  });
});

describe('reverse', () => {
  test('reverses array', () => {
    expect(reverse(['a', 'b', 'c'])).toEqual(['c', 'b', 'a']);
  });
  test('reverses string', () => {
    expect(reverse('abc')).toBe('cba');
  });
});

describe('slice', () => {
  test('splits array into slices', () => {
    expect(slice(['a', 'b', 'c', 'd'], 2)).toEqual([['a', 'b'], ['c', 'd']]);
  });
  test('fills last slice with fillWith', () => {
    const result = slice(['a', 'b', 'c'], 2, 'x');
    expect(result.length).toBe(2);
    expect(result[0]?.length).toBe(2);
    expect(result[1]?.includes('x')).toBe(true);
  });
});

describe('sum', () => {
  test('sums array', () => {
    expect(sum([1, 2, 3])).toBe(6);
  });
  test('sums with start', () => {
    expect(sum([1, 2, 3], undefined, 10)).toBe(16);
  });
  test('sums by attribute', () => {
    expect(sum([{ n: 1 }, { n: 2 }], 'n')).toBe(3);
  });
});

describe('sort', () => {
  test('sorts ascending', () => {
    expect(sort([3, 1, 2])).toEqual([1, 2, 3]);
  });
  test('sorts descending with reverse', () => {
    expect(sort([3, 1, 2], true)).toEqual([3, 2, 1]);
  });
  test('sorts by attribute', () => {
    expect(sort([{ n: 3 }, { n: 1 }], false, false, 'n')).toEqual([{ n: 1 }, { n: 3 }]);
  });
});

describe('select / reject', () => {
  test('select is a function', () => {
    expect(typeof select).toBe('function');
  });
  test('reject is a function', () => {
    expect(typeof reject).toBe('function');
  });
});
