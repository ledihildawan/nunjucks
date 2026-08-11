import { describe, test, expect } from 'bun:test';
import { replace, slice } from './pipe-helpers.ts';

describe('replace', () => {
  test('returns a curried transformer using a regex', () => {
    const upper = replace(/x/g, 'y');
    expect(upper('axbxc')).toBe('aybyc');
  });

  test('replaces the first match for a non-global regex', () => {
    expect(replace(/a/, 'b')('aaa')).toBe('baa');
  });

  test('supports plain-string patterns', () => {
    expect(replace('cat', 'dog')('the cat sat')).toBe('the dog sat');
  });
});

describe('slice', () => {
  test('returns a curried transformer for arrays', () => {
    const middle = slice(1, 3);
    expect(middle([1, 2, 3, 4])).toEqual([2, 3]);
  });

  test('preserves element types via the generic parameter', () => {
    const head = slice<number>(0, 1);
    expect(head([10, 20])).toEqual([10]);
  });

  test('handles a missing end bound', () => {
    expect(slice(2)([1, 2, 3, 4])).toEqual([3, 4]);
  });
});
