import { describe, test, expect } from 'bun:test';
import { isOk, isErr, getOrElse } from '@nunjucks/lib';
import { groupby } from './object.ts';

describe('filters/object', () => {
  describe('groupby', () => {
    test('groups items by the named attribute', () => {
      const items = [
        { type: 'fruit', name: 'apple' },
        { type: 'veg', name: 'carrot' },
        { type: 'fruit', name: 'banana' },
      ];
      const result = groupby(items, 'type');
      expect(isOk(result)).toBe(true);
      const grouped = getOrElse(result, null) as Record<string, Array<{ type: string; name: string }>>;
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
      const result = groupby(items, 'k');
      expect(isOk(result)).toBe(true);
      const grouped = getOrElse(result, null) as Record<string, Array<{ k: string; v: number }>>;
      expect(Object.keys(grouped)).toEqual(['a']);
      expect(grouped.a).toHaveLength(2);
    });

    test('coerces non-string attribute values to string keys', () => {
      const items = [
        { id: 1, name: 'one' },
        { id: 2, name: 'two' },
        { id: 1, name: 'uno' },
      ];
      const result = groupby(items, 'id');
      expect(isOk(result)).toBe(true);
      const grouped = getOrElse(result, null) as Record<string, Array<{ id: number; name: string }>>;
      expect(grouped['1']).toEqual([
        { id: 1, name: 'one' },
        { id: 1, name: 'uno' },
      ]);
      expect(grouped['2']).toEqual([{ id: 2, name: 'two' }]);
    });

    test('returns error when input is not an array', () => {
      const result1 = groupby('nope', 'k');
      expect(isErr(result1)).toBe(true);
      const result2 = groupby({ a: 1 }, 'k');
      expect(isErr(result2)).toBe(true);
      const result3 = groupby(null, 'k');
      expect(isErr(result3)).toBe(true);
    });

    test('returns error when an item is missing the named attribute', () => {
      const items = [
        { type: 'a' },
        { other: 'b' },
      ];
      const result = groupby(items, 'type');
      expect(isErr(result)).toBe(true);
    });
  });
});