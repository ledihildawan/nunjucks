import { describe, test, expect } from 'bun:test';
import { getAttrGetter } from './attribute-getter.ts';

describe('getAttrGetter', () => {
  test('descends nested own properties', () => {
    const getter = getAttrGetter('a.b');
    expect(getter({ a: { b: 42 } })).toBe(42);
  });

  test('descends every part of a dotted attribute', () => {
    const getter = getAttrGetter('a.b.c');
    expect(getter({ a: { b: { c: 7 } } })).toBe(7);
  });

  test('returns undefined when a link in the chain is missing', () => {
    const getter = getAttrGetter('a.b.c');
    expect(getter({ a: {} })).toBeUndefined();
  });

  test('resolves numeric parts when present', () => {
    const getter = getAttrGetter('0');
    expect(getter([99, 88])).toBe(99);
  });

  test('treats a numeric attribute as a single part', () => {
    const getter = getAttrGetter(0);
    expect(getter([99, 88])).toBe(99);
  });
});