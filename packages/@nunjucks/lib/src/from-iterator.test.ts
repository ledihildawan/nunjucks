import { describe, expect, test } from 'bun:test';
import { fromIterator } from './from-iterator.ts';

describe('fromIterator', () => {
  test('returns arrays unchanged by reference', () => {
    const values = [1, 2, 3];
    expect(fromIterator(values)).toBe(values);
  });

  test('returns primitives and strings unchanged', () => {
    expect(fromIterator('abc')).toBe('abc');
    expect(fromIterator(42)).toBe(42);
    expect(fromIterator(null)).toBe(null);
    expect(fromIterator(undefined)).toBe(undefined);
  });

  test('materializes non-array iterables into arrays', () => {
    expect(fromIterator(new Set(['x', 'y']))).toEqual(['x', 'y']);
    expect(fromIterator(new Map([['a', 1]]))).toEqual([['a', 1]]);
  });

  test('materializes generators into arrays', () => {
    const numbers = function* (): Generator<number> {
      yield 1;
      yield 2;
    };
    expect(fromIterator(numbers())).toEqual([1, 2]);
  });

  test('returns plain non-iterable objects unchanged by reference', () => {
    const record = { name: 'nunjucks' };
    expect(fromIterator(record)).toBe(record);
  });
});
