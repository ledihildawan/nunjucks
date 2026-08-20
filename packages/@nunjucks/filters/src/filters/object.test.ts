import { describe, expect, test } from 'bun:test';
import { getOrElse, isErr, isOk } from '@nunjucks/lib';
import { dictsort, dump, groupby } from './object.ts';

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
      const grouped = getOrElse(result, null) as Record<
        string,
        Array<{ type: string; name: string }>
      >;
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
      const grouped = getOrElse(result, null) as Record<
        string,
        Array<{ id: number; name: string }>
      >;
      expect(grouped['1']).toEqual([
        { id: 1, name: 'one' },
        { id: 1, name: 'uno' },
      ]);
      expect(grouped['2']).toEqual([{ id: 2, name: 'two' }]);
    });

    test('returns error when input is not an array', () => {
      const stringInputResult = groupby('nope', 'k');
      expect(isErr(stringInputResult)).toBe(true);
      const objectInputResult = groupby({ a: 1 }, 'k');
      expect(isErr(objectInputResult)).toBe(true);
      const nullInputResult = groupby(null, 'k');
      expect(isErr(nullInputResult)).toBe(true);
    });

    test('returns error when an item is missing the named attribute', () => {
      const items = [{ type: 'a' }, { other: 'b' }];
      const result = groupby(items, 'type');
      expect(isErr(result)).toBe(true);
    });

    test('groups items by a dotted attribute path', () => {
      // WHY: regression — grouping resolved 'user.team' via getAttrGetter but
      // validation rejected dotted attrs as nonexistent.
      const items = [
        { user: { team: 'red' }, name: 'a' },
        { user: { team: 'blue' }, name: 'b' },
        { user: { team: 'red' }, name: 'c' },
      ];
      const result = groupby(items, 'user.team');
      expect(isOk(result)).toBe(true);
      const grouped = getOrElse(result, null) as Record<string, unknown[]>;
      expect(grouped.red).toEqual([
        { user: { team: 'red' }, name: 'a' },
        { user: { team: 'red' }, name: 'c' },
      ]);
      expect(grouped.blue).toEqual([{ user: { team: 'blue' }, name: 'b' }]);
    });
  });

  describe('dictsort', () => {
    test('sorts entries as [key, value] pairs by key', () => {
      const result = dictsort({ b: 1, a: 2 });
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([
        ['a', 2],
        ['b', 1],
      ]);
    });

    test('sorts keys case-insensitively by default', () => {
      const result = dictsort({ B: 1, a: 2 });
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([
        ['a', 2],
        ['B', 1],
      ]);
    });

    test('sorts keys case-sensitively when caseSensitive is set', () => {
      const result = dictsort({ B: 1, a: 2 }, true);
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([
        ['B', 1],
        ['a', 2],
      ]);
    });

    test('sorts by value when by="value"', () => {
      const result = dictsort({ a: 2, b: 1 }, false, 'value');
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toEqual([
        ['b', 1],
        ['a', 2],
      ]);
    });

    test('returns error when by is neither key nor value', () => {
      const result = dictsort({ a: 1 }, false, 'nope');
      expect(isErr(result)).toBe(true);
    });

    test('returns error when input is not a plain object', () => {
      const arrayResult = dictsort([1, 2]);
      expect(isErr(arrayResult)).toBe(true);
      const stringResult = dictsort('nope');
      expect(isErr(stringResult)).toBe(true);
      const nullResult = dictsort(null);
      expect(isErr(nullResult)).toBe(true);
    });
  });

  describe('dump', () => {
    test('serializes compactly by default', () => {
      const result = dump({ a: 1, b: 'two' });
      expect(isOk(result)).toBe(true);
      expect(getOrElse(result, null)).toBe('{"a":1,"b":"two"}');
    });

    test('serializes arrays and primitives', () => {
      expect(getOrElse(dump([1, 2, 3]), null)).toBe('[1,2,3]');
      expect(getOrElse(dump('hi'), null)).toBe('"hi"');
      expect(getOrElse(dump(null), null)).toBe('null');
    });

    test('indents with the spaces argument', () => {
      const result = dump({ a: 1 }, 2);
      expect(getOrElse(result, null)).toBe('{\n  "a": 1\n}');
    });

    test('substitutes "undefined" for values JSON cannot encode', () => {
      expect(getOrElse(dump(undefined), null)).toBe('undefined');
      expect(
        getOrElse(
          dump(() => 1),
          null
        )
      ).toBe('undefined');
    });

    test('returns error on cyclic references', () => {
      const cyclic: Record<string, unknown> = {};
      cyclic.self = cyclic;
      const result = dump(cyclic);
      expect(isErr(result)).toBe(true);
    });

    test('binds obj and spaces from keyword arguments', () => {
      const result = dump({ keywords: true, obj: { a: 1 }, spaces: 2 });
      expect(getOrElse(result, null)).toBe('{\n  "a": 1\n}');
    });
  });
});
