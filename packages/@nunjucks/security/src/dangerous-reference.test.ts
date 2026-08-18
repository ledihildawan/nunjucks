import { describe, expect, test } from 'bun:test';
import { isDangerousReference } from './dangerous-reference.ts';

describe('isDangerousReference', () => {
  test('returns false for primitives', () => {
    expect(isDangerousReference(null)).toBe(false);
    expect(isDangerousReference(undefined)).toBe(false);
    expect(isDangerousReference(42)).toBe(false);
    expect(isDangerousReference('string')).toBe(false);
    expect(isDangerousReference(false)).toBe(false);
  });

  test('returns true for globalThis', () => {
    expect(isDangerousReference(globalThis)).toBe(true);
  });

  test('returns true for process', () => {
    expect(isDangerousReference(process)).toBe(true);
  });

  test('returns false for Buffer constructor', () => {
    expect(isDangerousReference(Buffer)).toBe(false);
  });

  test('returns false for plain objects', () => {
    expect(isDangerousReference({})).toBe(false);
    expect(isDangerousReference({ a: 1 })).toBe(false);
  });

  test('returns false for arrays', () => {
    expect(isDangerousReference([])).toBe(false);
    expect(isDangerousReference([1, 2, 3])).toBe(false);
  });

  test('returns false for functions', () => {
    expect(isDangerousReference(() => {})).toBe(false);
  });
});
