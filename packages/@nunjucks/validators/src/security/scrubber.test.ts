import { describe, expect, test } from 'bun:test';
import { scrubDangerousReferences } from './scrubber.ts';

// WHY: all tests go through the public scrubDangerousReferences entry — the
// internal visitAndScrub recursion used to be exported only for these tests.
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

    test('passes exotic objects through untouched (prototype carries behavior)', () => {
      const createdAt = new Date(0);
      const registry = new Map([['k', 1]]);
      const result = scrubDangerousReferences({ createdAt, registry }) as Record<string, unknown>;
      expect(result.createdAt).toBe(createdAt);
      expect((result.createdAt as Date).getFullYear()).toBe(1970);
      expect(result.registry).toBe(registry);
      expect((result.registry as Map<string, number>).get('k')).toBe(1);
    });

    test('cycles become placeholders — no dangerous reference survives through a cycle', () => {
      const obj: Record<string, unknown> = { a: 1, dangerous: globalThis };
      obj.self = obj;
      const result = scrubDangerousReferences(obj) as Record<string, unknown>;
      expect(result.a).toBe(1);
      expect(result.self).toBe('[Circular]');
      const reachable = (result.self as { dangerous?: unknown }).dangerous;
      expect(reachable).toBeUndefined();
    });

    test('deeply nested values past the depth cap pass through without overflowing', () => {
      let deep: Record<string, unknown> = { leaf: true };
      for (let i = 0; i < 50_000; i += 1) {
        deep = { nested: deep };
      }
      const result = scrubDangerousReferences({ deep }) as Record<string, unknown>;
      expect(Object.hasOwn(result as object, 'deep')).toBe(true);
    });
  });
});
