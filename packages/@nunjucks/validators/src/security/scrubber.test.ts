import { describe, expect, test } from 'bun:test';
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
    const visit = (value: unknown): unknown =>
      visitAndScrub({ value, seen: new WeakSet(), depth: 0 });

    test('returns non-objects unchanged', () => {
      expect(visit(42)).toBe(42);
      expect(visit('test')).toBe('test');
      expect(visit(null)).toBeNull();
    });

    test('passes exotic objects through untouched (prototype carries behavior)', () => {
      const createdAt = new Date(0);
      const registry = new Map([['k', 1]]);
      const result = visit({ createdAt, registry }) as Record<string, unknown>;
      expect(result.createdAt).toBe(createdAt);
      expect((result.createdAt as Date).getFullYear()).toBe(1970);
      expect(result.registry).toBe(registry);
      expect((result.registry as Map<string, number>).get('k')).toBe(1);
    });

    test('removes top-level dangerous references', () => {
      const result = visit({ a: 1, dangerous: globalThis }) as Record<string, unknown>;
      expect(Object.hasOwn(result, 'dangerous')).toBe(false);
      expect(result.a).toBe(1);
    });

    test('preserves nested objects', () => {
      const nested = { x: 10 };
      const result = visit({ nested }) as Record<string, unknown>;
      expect(result.nested).toEqual(nested);
    });

    test('handles arrays by scrubbing elements', () => {
      const result = visit([1, 2, 3]);
      expect(result).toEqual([1, 2, 3]);
    });

    test('cycles become placeholders — no dangerous reference survives through a cycle', () => {
      const obj: Record<string, unknown> = { a: 1, dangerous: globalThis };
      obj.self = obj;
      const result = visit(obj) as Record<string, unknown>;
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
      const result = visit({ deep }) as Record<string, unknown>;
      expect(Object.hasOwn(result as object, 'deep')).toBe(true);
    });
  });
});
