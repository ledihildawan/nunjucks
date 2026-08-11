import { describe, test, expect } from 'bun:test';
import { normalizeRenderContext } from './safe-context.ts';

describe('normalizeRenderContext', () => {
  test('passes through primitives untouched', () => {
    expect(normalizeRenderContext('hi')).toBe('hi');
    expect(normalizeRenderContext(42)).toBe(42);
    expect(normalizeRenderContext(true)).toBe(true);
    expect(normalizeRenderContext(null)).toBe(null);
    expect(normalizeRenderContext(undefined)).toBe('[Undefined]');
  });

  test('serializes plain object values', () => {
    const out = normalizeRenderContext({ a: 1, b: 'x' }) as Record<string, unknown>;
    expect(out.a).toBe(1);
    expect(out.b).toBe('x');
  });

  test('redacts explicitly blocked keys', () => {
    const out = normalizeRenderContext(
      { secret: 'hidden', ok: 1 },
      { blockedKeys: ['secret'] },
    ) as Record<string, unknown>;
    expect(out.secret).toBe('[Redacted]');
    expect(out.ok).toBe(1);
  });

  test('marks circular references', () => {
    const data: Record<string, unknown> = { a: 1 };
    data.cycle = data;
    const out = normalizeRenderContext(data) as Record<string, unknown>;
    expect(out.a).toBe(1);
    expect(out.cycle).toBe('[Circular]');
  });

  test('formats functions and arrays', () => {
    const named = function named() { /* noop */ };
    expect(normalizeRenderContext(named)).toBe('[Function: named]');
    const out = normalizeRenderContext([1, 2]) as unknown[];
    expect(out[0]).toBe(1);
    expect(out[1]).toBe(2);
  });
});
