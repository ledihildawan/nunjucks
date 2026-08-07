import { describe, test, expect } from 'bun:test';
import { groupby } from './object.ts';

describe('filters/object', () => {
  describe('groupby', () => {
    test('groups items by the named attribute', () => {
      const items = [
        { type: 'fruit', name: 'apple' },
        { type: 'veg', name: 'carrot' },
        { type: 'fruit', name: 'banana' },
      ];
      const grouped = groupby(items, 'type') as Record<string, Array<{ type: string; name: string }>>;
      expect(grouped.fruit).toEqual([
        { type: 'fruit', name: 'apple' },
        { type: 'fruit', name: 'banana' },
      ]);
      expect(grouped.veg).toEqual([{ type: 'veg', name: 'carrot' }]);
    });

    test('returns an object with a single key when every item shares an attribute value', () => {
      const items = [
        { k: 'a', v: 1 },
        { k: 'a', v: 2 },
      ];
      const grouped = groupby(items, 'k') as Record<string, Array<{ k: string; v: number }>>;
      expect(Object.keys(grouped)).toEqual(['a']);
      expect(grouped.a).toHaveLength(2);
    });

    test('coerces non-string attribute values to string keys', () => {
      const items = [
        { id: 1, name: 'one' },
        { id: 2, name: 'two' },
        { id: 1, name: 'uno' },
      ];
      const grouped = groupby(items, 'id') as Record<string, Array<{ id: number; name: string }>>;
      expect(grouped['1']).toEqual([
        { id: 1, name: 'one' },
        { id: 1, name: 'uno' },
      ]);
      expect(grouped['2']).toEqual([{ id: 2, name: 'two' }]);
    });

    test('throws when input is not an array', () => {
      expect(() => groupby('nope', 'k')).toThrow();
      expect(() => groupby({ a: 1 }, 'k')).toThrow();
      expect(() => groupby(null, 'k')).toThrow();
    });

    test('throws when an item is missing the named attribute', () => {
      const items = [
        { type: 'a' },
        { other: 'b' },
      ];
      expect(() => groupby(items, 'type')).toThrow(/type/);
    });
  });
});