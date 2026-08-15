import { describe, expect, test } from 'bun:test';
import { compareValues, createSortComparator, toComparable } from './compare.ts';

describe('toComparable', () => {
  test('keeps strings and numbers as-is', () => {
    expect(toComparable('a')).toBe('a');
    expect(toComparable(3)).toBe(3);
  });

  test('coerces anything else to a string', () => {
    expect(toComparable(null)).toBe('null');
    expect(toComparable({})).toBe('[object Object]');
  });
});

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
