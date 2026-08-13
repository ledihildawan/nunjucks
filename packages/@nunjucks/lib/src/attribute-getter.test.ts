import { describe, test, expect } from 'bun:test';
import { prepareAttributeParts, getAttrGetter } from './attribute-getter.ts';

describe('prepareAttributeParts', () => {
  test('splits dotted strings into parts', () => {
    expect(prepareAttributeParts('a.b.c')).toEqual(['a', 'b', 'c']);
  });

  test('returns an empty array for nullish input', () => {
    expect(prepareAttributeParts(null)).toEqual([]);
    expect(prepareAttributeParts(undefined)).toEqual([]);
  });

  test('passes numbers through as single parts', () => {
    expect(prepareAttributeParts(0)).toEqual([0]);
  });
});

describe('getAttrGetter', () => {
  test('descends nested own properties', () => {
    const getter = getAttrGetter('a.b');
    expect(getter({ a: { b: 42 } })).toBe(42);
  });

  test('returns undefined when a link in the chain is missing', () => {
    const getter = getAttrGetter('a.b.c');
    expect(getter({ a: {} })).toBeUndefined();
  });

  test('resolves numeric parts when present', () => {
    const getter = getAttrGetter('0');
    expect(getter([99, 88])).toBe(99);
  });
});