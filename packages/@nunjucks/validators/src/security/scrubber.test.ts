import { describe, test, expect } from 'bun:test';
import { scrubDangerousReferences, visitAndScrub } from './scrubber.ts';

describe('scrubber', () => {
  describe('scrubDangerousReferences', () => {
    test('returns primitive values unchanged', () => {
      expect(scrubDangerousReferences(null)).toBeNull();
      expect(scrubDangerousReferences(42)).toBe(42);
      expect(scrubDangerousReferences('hello')).toBe('hello');
      expect(scrubDangerousReferences(undefined)).toBeUndefined();
    });

    test('returns simple objects unchanged when safe', () => {
      const context = { name: 'Ada', age: 42 };
      expect(scrubDangerousReferences(context)).toEqual(context);
    });

    test('removes top-level dangerous references', () => {
      const context = { user: 'Ada', dangerous: globalThis, safe: 'value' };
      const result = scrubDangerousReferences(context) as Record<string, unknown>;
      expect(Object.hasOwn(result, 'dangerous')).toBe(false);
      expect(result.user).toBe('Ada');
      expect(result.safe).toBe('value');
    });

    test('handles arrays', () => {
      const context = { items: ['a', 'b', 'c'] };
      expect(scrubDangerousReferences(context)).toEqual(context);
    });

    test('preserves nested objects without top-level dangerous references', () => {
      const nested = { a: 1, b: 2 };
      const context = { nested };
      const result = scrubDangerousReferences(context) as Record<string, unknown>;
      expect(result.nested).toEqual(nested);
    });

    test('handles empty objects', () => {
      expect(scrubDangerousReferences({})).toEqual({});
    });

    test('handles empty arrays', () => {
      expect(scrubDangerousReferences([])).toEqual([]);
    });

    test('preserves string values even if named eval', () => {
      const context = { code: 'eval("alert(1)")' };
      expect(scrubDangerousReferences(context)).toEqual(context);
    });

    test('preserves process global (not dangerous by itself)', () => {
      const context = { pid: process.pid };
      expect(scrubDangerousReferences(context)).toEqual(context);
    });
  });

  describe('visitAndScrub', () => {
    test('returns non-objects unchanged', () => {
      expect(visitAndScrub(42, new WeakSet())).toBe(42);
      expect(visitAndScrub('test', new WeakSet())).toBe('test');
      expect(visitAndScrub(null, new WeakSet())).toBeNull();
    });

    test('removes top-level dangerous references', () => {
      const seen = new WeakSet();
      const result = visitAndScrub({ a: 1, dangerous: globalThis }, seen) as Record<string, unknown>;
      expect(Object.hasOwn(result, 'dangerous')).toBe(false);
      expect(result.a).toBe(1);
    });

    test('preserves nested objects', () => {
      const seen = new WeakSet();
      const nested = { x: 10 };
      const result = visitAndScrub({ nested }, seen) as Record<string, unknown>;
      expect(result.nested).toEqual(nested);
    });

    test('handles arrays by scrubbing elements', () => {
      const seen = new WeakSet();
      const result = visitAndScrub([1, 2, 3], seen);
      expect(result).toEqual([1, 2, 3]);
    });

    test('tracks seen objects to prevent infinite recursion', () => {
      const seen = new WeakSet();
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj;
      const result = visitAndScrub(obj, seen) as Record<string, unknown>;
      expect(result.a).toBe(1);
      expect(result.self).toBe(obj);
    });
  });
});
