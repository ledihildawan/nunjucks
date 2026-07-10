import { describe, test, expect } from 'bun:test';
import { dictsort } from './object.js';

describe('dictsort', () => {
  test('sorts object by key', () => {
    const result = dictsort({ b: 2, a: 1, c: 3 });
    expect(result).toEqual([['a', 1], ['b', 2], ['c', 3]]);
  });

  test('sorts object by value', () => {
    const result = dictsort({ a: 3, b: 1, c: 2 }, false, 'value');
    expect(result).toEqual([['b', 1], ['c', 2], ['a', 3]]);
  });

  test('sorts case-insensitively by default', () => {
    const result = dictsort({ B: 2, a: 1 });
    expect(result).toEqual([['a', 1], ['B', 2]]);
  });

  test('sorts case-sensitively when caseSensitive is true', () => {
    const result = dictsort({ B: 2, a: 1 }, true);
    const keys = result.map(pair => pair[0]);
    expect(keys).toEqual(['B', 'a']);
  });

  test('throws for non-object', () => {
    expect(() => dictsort('not-object')).toThrow('dictsort filter: val must be an object');
    expect(() => dictsort(42)).toThrow('dictsort filter: val must be an object');
  });

  test('throws for invalid by parameter', () => {
    expect(() => dictsort({ a: 1 }, false, 'invalid')).toThrow(
      'dictsort filter: You can only sort by either key or value'
    );
  });
});
