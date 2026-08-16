import { describe, expect, test } from 'bun:test';
import { compareValues, createSortComparator } from './compare.ts';

describe('compareValues', () => {
  test('sorts ascending by default', () => {
    const result = [3, 1, 2].toSorted((a, b) =>
      compareValues({ left: a, right: b, caseSens: true, sortReverse: false })
    );
    expect(result).toEqual([1, 2, 3]);
  });

  test('inverts the order when sortReverse is set', () => {
    expect(compareValues({ left: 'a', right: 'b', caseSens: true, sortReverse: true })).toBe(1);
  });

  test('compares case-insensitively when caseSens is unset', () => {
    expect(compareValues({ left: 'A', right: 'b', caseSens: undefined, sortReverse: false })).toBe(
      -1
    );
  });

  test('compares strings and numbers natively', () => {
    expect(compareValues({ left: 'a', right: 'b', caseSens: true, sortReverse: false })).toBe(-1);
    expect(compareValues({ left: 3, right: 10, caseSens: true, sortReverse: false })).toBe(-1);
  });

  test('coerces non-primitive values to their string form', () => {
    expect(compareValues({ left: null, right: 'null', caseSens: true, sortReverse: false })).toBe(0);
    expect(compareValues({ left: {}, right: '[object Object]', caseSens: true, sortReverse: false })).toBe(0);
  });
});

describe('createSortComparator', () => {
  const byAge = createSortComparator({ sortAttr: 'age', caseSens: true });

  test('compares values extracted via the attribute getter', () => {
    expect(byAge({ age: 30 }, { age: 20 })).toBe(1);
  });

  test('compares whole values when no attribute is given', () => {
    const byValue = createSortComparator({});
    expect(byValue('b', 'a')).toBe(1);
  });
});
