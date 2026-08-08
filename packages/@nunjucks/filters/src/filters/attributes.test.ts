import { describe, test, expect } from 'bun:test';
import { prepareAttributeParts, getAttrGetter } from './attributes.ts';

describe('filters/attributes', () => {
  describe('prepareAttributeParts', () => {
    test('returns empty array for null', () => {
      expect(prepareAttributeParts(null)).toEqual([]);
    });

    test('returns empty array for undefined', () => {
      expect(prepareAttributeParts(undefined)).toEqual([]);
    });

    test('returns array with number as-is', () => {
      expect(prepareAttributeParts(0)).toEqual([0]);
      expect(prepareAttributeParts(42)).toEqual([42]);
    });

    test('splits dot-separated string', () => {
      expect(prepareAttributeParts('a.b.c')).toEqual(['a', 'b', 'c']);
    });

    test('returns single part for plain string', () => {
      expect(prepareAttributeParts('foo')).toEqual(['foo']);
    });

    test('handles empty string', () => {
      expect(prepareAttributeParts('')).toEqual(['']);
    });
  });

  describe('getAttrGetter', () => {
    test('returns accessor for top-level key', () => {
      const getter = getAttrGetter('name');
      expect(getter({ name: 'Alice' })).toBe('Alice');
      expect(getter({ name: 'Bob' })).toBe('Bob');
    });

    test('returns undefined for missing top-level key', () => {
      const getter = getAttrGetter('name');
      expect(getter({})).toBe(undefined);
      expect(getter({ age: 30 })).toBe(undefined);
    });

    test('returns accessor for nested key', () => {
      const getter = getAttrGetter('user.address.city');
      const item = { user: { address: { city: 'NYC' } } };
      expect(getter(item)).toBe('NYC');
    });

    test('returns undefined when nested path is broken', () => {
      const getter = getAttrGetter('user.address.city');
      expect(getter({ user: { city: 'NYC' } })).toBe(undefined);
      expect(getter({ user: null })).toBe(undefined);
      expect(getter({})).toBe(undefined);
    });

    test('handles numeric key via dot notation', () => {
      const getter = getAttrGetter('0.name');
      expect(getter(['Alice', 'Bob'] as unknown as Record<string, unknown>)).toBe(undefined);
      expect(getter([{ name: 'Carol' }] as unknown as Record<string, unknown>)).toBe('Carol');
    });
  });
});
