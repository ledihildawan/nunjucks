import { describe, test, expect } from 'bun:test';
import { scrubDangerousReferences, visitAndScrub } from './scrubber.ts';

describe('scrubDangerousReferences', () => {
  test('removes dangerous reference values and returns a clone', () => {
    const ctx = { a: 1, b: globalThis, c: 'x' } as Record<string, unknown>;
    const result = scrubDangerousReferences(ctx, null) as Record<string, unknown>;
    expect(result.a).toBe(1);
    expect(result.c).toBe('x');
    expect('b' in result).toBe(false);
    expect(ctx.b).toBe(globalThis);
  });

  test('recurses into nested objects (deep clone, original untouched)', () => {
    const ctx = { nested: { safe: 1, danger: globalThis } } as { nested: Record<string, unknown> };
    const result = scrubDangerousReferences(ctx, null) as { nested: Record<string, unknown> };
    expect(result.nested.safe).toBe(1);
    expect('danger' in result.nested).toBe(false);
    expect(ctx.nested.danger).toBe(globalThis);
  });

  test('recurses into arrays and scrubs element objects', () => {
    const ctx = { items: [1, { ok: true, bad: globalThis }] };
    const result = scrubDangerousReferences(ctx, null) as { items: unknown[] };
    expect(result.items[0]).toBe(1);
    const elem = result.items[1] as Record<string, unknown>;
    expect(elem.ok).toBe(true);
    expect('bad' in elem).toBe(false);
  });

  test('leaves a safe context value-equal but a new root object', () => {
    const ctx = { a: 1 };
    const result = scrubDangerousReferences(ctx, null);
    expect(result).toEqual(ctx);
    expect(result).not.toBe(ctx);
  });

  test('passes primitives and null/undefined through', () => {
    expect(scrubDangerousReferences(null, null)).toBeNull();
    expect(scrubDangerousReferences(undefined, null)).toBeUndefined();
    expect(scrubDangerousReferences('s', null)).toBe('s');
    expect(scrubDangerousReferences(42, null)).toBe(42);
  });

  test('handles circular references without looping', () => {
    const obj: Record<string, unknown> = { name: 'x' };
    obj.self = obj;
    const result = scrubDangerousReferences(obj, null) as Record<string, unknown>;
    expect(result.name).toBe('x');
  });
});

describe('visitAndScrub', () => {
  test('returns primitives unchanged', () => {
    expect(visitAndScrub('s', new WeakSet())).toBe('s');
    expect(visitAndScrub(42, new WeakSet())).toBe(42);
  });

  test('scrubs a plain object via the shared seen-set', () => {
    const result = visitAndScrub({ a: 1, danger: globalThis }, new WeakSet()) as Record<string, unknown>;
    expect(result.a).toBe(1);
    expect('danger' in result).toBe(false);
  });
});
