import { describe, expect, test } from 'bun:test';
import { copySafeness, createSafeString, isSafeString, markSafe } from './safe-string.ts';

describe('createSafeString', () => {
  test('wraps a string with String prototype and non-enumerable val', () => {
    const safe = createSafeString('<b>bold</b>');
    expect(String(safe)).toBe('<b>bold</b>');
    expect(safe.val).toBe('<b>bold</b>');
    expect(safe.length).toBe(11);
  });

  test('passes through non-string values untouched', () => {
    expect(createSafeString(42)).toBe(42);
    expect(createSafeString(null)).toBe(null);
  });
});

describe('isSafeString', () => {
  test('accepts genuine SafeStrings', () => {
    expect(isSafeString(createSafeString('trusted'))).toBe(true);
    expect(isSafeString(markSafe('trusted'))).toBe(true);
    expect(isSafeString(markSafe(() => 'trusted')())).toBe(true);
  });

  test('rejects primitives and nullish values', () => {
    expect(isSafeString('plain')).toBe(false);
    expect(isSafeString('')).toBe(false);
    expect(isSafeString(0)).toBe(false);
    expect(isSafeString(null)).toBe(false);
    expect(isSafeString(undefined)).toBe(false);
    expect(isSafeString(false)).toBe(false);
  });

  test('rejects plain context objects carrying a val field (autoescape bypass vector)', () => {
    expect(isSafeString({ val: '</script><script>alert(1)</script>' })).toBe(false);
    expect(isSafeString({ val: 'x', toString: () => 'x' })).toBe(false);
    expect(isSafeString(Object.create(String.prototype, { val: { value: 'x', enumerable: true } }))).toBe(
      false
    );
  });

  test('rejects partially forged shapes missing the full own non-enumerable property set', () => {
    expect(isSafeString(Object.create(String.prototype, { val: { value: 'x' } }))).toBe(false);
    expect(
      isSafeString(
        Object.create(String.prototype, {
          val: { value: 'x' },
          length: { value: 1 },
          toString: { value: () => 'x' },
        })
      )
    ).toBe(false);
    expect(
      isSafeString({
        val: 'x',
        length: 1,
        valueOf: () => 'x',
        toString: () => 'x',
      })
    ).toBe(false);
  });

  test('rejects accessor-based val properties', () => {
    expect(
      isSafeString(
        Object.create(String.prototype, {
          val: { get: () => 'x', enumerable: false },
        })
      )
    ).toBe(false);
  });
});

describe('copySafeness', () => {
  test('propagates safeness from a genuine SafeString source', () => {
    const result = copySafeness(createSafeString('src'), 'target');
    expect(isSafeString(result)).toBe(true);
    expect(String(result)).toBe('target');
  });

  test('returns a plain string when the source is not a SafeString', () => {
    const result = copySafeness({ val: 'forged' }, 'target');
    expect(isSafeString(result)).toBe(false);
    expect(result).toBe('target');
    expect(copySafeness(null, 'target')).toBe('target');
  });
});
