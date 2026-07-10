import { describe, test, expect } from 'bun:test';
import {
  batch, first, last, lengthFilter, list,
  random, reverse,
  slice,
  sum, sort, rejectattr, selectattr,
  select, reject,
} from './array.js';

describe('batch', () => {
  test('splits array into batches', () => {
    expect(batch([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  test('fills last batch with fillWith', () => {
    expect(batch([1, 2, 3, 4, 5], 3, 'x')).toEqual([[1, 2, 3], [4, 5, 'x']]);
  });

  test('returns empty array for empty input', () => {
    expect(batch([], 3)).toEqual([]);
  });
});

describe('first', () => {
  test('returns first element', () => {
    expect(first([1, 2, 3])).toBe(1);
    expect(first(['a'])).toBe('a');
  });

  test('returns undefined for empty array', () => {
    expect(first([])).toBeUndefined();
  });
});

describe('last', () => {
  test('returns last element', () => {
    expect(last([1, 2, 3])).toBe(3);
  });

  test('returns undefined for empty array', () => {
    expect(last([])).toBeUndefined();
  });
});

describe('lengthFilter', () => {
  test('returns length of array', () => {
    expect(lengthFilter([1, 2, 3])).toBe(3);
  });

  test('returns length of string', () => {
    expect(lengthFilter('hello')).toBe(5);
  });

  test('returns 0 for null/undefined', () => {
    expect(lengthFilter(null)).toBe(0);
    expect(lengthFilter(undefined)).toBe(0);
  });
});

describe('list', () => {
  test('splits string into characters', () => {
    expect(list('abc')).toEqual(['a', 'b', 'c']);
  });

  test('returns array as-is', () => {
    const arr = [1, 2, 3];
    expect(list(arr)).toBe(arr);
  });

  test('converts object to key-value entries', () => {
    expect(list({ a: 1, b: 2 })).toEqual([{ key: 'a', value: 1 }, { key: 'b', value: 2 }]);
  });

  test('throws for non-iterable', () => {
    expect(() => list(42)).toThrow('list filter: type not iterable');
  });
});

describe('random', () => {
  test('returns an element from the array', () => {
    const arr = [1, 2, 3];
    const result = random(arr);
    expect(arr).toContain(result);
  });

  test('returns undefined for empty array', () => {
    expect(random([])).toBeUndefined();
  });
});

describe('reverse', () => {
  test('reverses array', () => {
    expect(reverse([1, 2, 3])).toEqual([3, 2, 1]);
  });

  test('does not mutate original', () => {
    const arr = [1, 2, 3];
    reverse(arr);
    expect(arr).toEqual([1, 2, 3]);
  });
});

describe('slice filter', () => {
  test('splits array into slices', () => {
    const result = slice([1, 2, 3, 4, 5, 6], 3);
    expect(result).toEqual([[1, 2], [3, 4], [5, 6]]);
  });

  test('fills extra slice with fillWith', () => {
    const result = slice([1, 2, 3, 4], 3, 'x');
    expect(result[2]).toEqual([4, 'x']);
  });
});

describe('sum', () => {
  test('sums array of numbers', () => {
    expect(sum([1, 2, 3])).toBe(6);
  });

  test('uses start value', () => {
    expect(sum([1, 2, 3], null, 10)).toBe(16);
  });

  test('defaults start to 0', () => {
    expect(sum([])).toBe(0);
  });
});

describe('sort', () => {
  const mockThis = { env: { opts: { throwOnUndefined: false } } };

  test('sorts array ascending', () => {
    expect(sort.call(mockThis, [3, 1, 2])).toEqual([1, 2, 3]);
  });

  test('sorts array reversed', () => {
    expect(sort.call(mockThis, [1, 2, 3], true)).toEqual([3, 2, 1]);
  });

  test('sorts case-insensitive by default', () => {
    expect(sort.call(mockThis, ['B', 'a', 'C'])).toEqual(['a', 'B', 'C']);
  });

  test('sorts case-sensitive', () => {
    expect(sort.call(mockThis, ['B', 'a', 'C'], false, true)).toEqual(['B', 'C', 'a']);
  });

  test('does not mutate original', () => {
    const arr = [3, 1, 2];
    sort.call(mockThis, arr);
    expect(arr).toEqual([3, 1, 2]);
  });
});

describe('selectattr / rejectattr', () => {
  const items = [{ active: true }, { active: false }, { active: true }];

  test('selectattr keeps items with truthy attr', () => {
    expect(selectattr(items, 'active')).toEqual([{ active: true }, { active: true }]);
  });

  test('rejectattr keeps items with falsy attr', () => {
    expect(rejectattr(items, 'active')).toEqual([{ active: false }]);
  });
});

describe('select / reject', () => {
  const mockCtx = {
    env: {
      getTest: () => (item) => item % 2 === 0,
    },
  };

  test('select filters to truthy test results', () => {
    const result = select.call(mockCtx, [1, 2, 3, 4]);
    expect(result).toEqual([2, 4]);
  });

  test('reject filters to falsy test results', () => {
    const result = reject.call(mockCtx, [1, 2, 3, 4]);
    expect(result).toEqual([1, 3]);
  });
});
