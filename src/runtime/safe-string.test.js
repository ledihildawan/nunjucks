import { describe, test, expect } from 'bun:test';
import { createSafeString, copySafeness, markSafe } from './safe-string.js';

describe('createSafeString', () => {
  test('stores string value and length', () => {
    const s = createSafeString('hello');
    expect(s.val).toBe('hello');
    expect(s.length).toBe(5);
  });

  test('returns value as-is for non-string', () => {
    const r = createSafeString(42);
    expect(r).toBe(42);
  });

  test('valueOf returns stored value', () => {
    const s = createSafeString('test');
    expect(s.valueOf()).toBe('test');
  });

  test('toString returns stored value', () => {
    const s = createSafeString('test');
    expect(s.toString()).toBe('test');
  });

  test('instanceof String', () => {
    const s = createSafeString('hello');
    expect(s).toBeInstanceOf(String);
    expect(typeof s).toBe('object');
  });
});

describe('copySafeness', () => {
  test('wraps target in SafeString when dest is SafeString', () => {
    const result = copySafeness(createSafeString('original'), 'newval');
    expect(result.val).toBe('newval');
  });

  test('returns target.toString() when dest is not SafeString', () => {
    const result = copySafeness('plain', 42);
    expect(result).toBe('42');
  });

  test('handles boolean target', () => {
    const result = copySafeness('plain', true);
    expect(result).toBe('true');
  });

  test('throws for null target (target.toString fails)', () => {
    expect(() => copySafeness('plain', null)).toThrow();
  });
});

describe('markSafe', () => {
  test('wraps string in SafeString', () => {
    const result = markSafe('hello');
    expect(result).toBeInstanceOf(String);
    expect(result.val).toBe('hello');
  });

  test('returns non-string, non-function values as-is', () => {
    expect(markSafe(42)).toBe(42);
    expect(markSafe(true)).toBe(true);
    expect(markSafe(null)).toBe(null);
    expect(markSafe({})).toEqual({});
  });

  test('wraps function return values in SafeString', () => {
    const wrapped = markSafe(() => 'result');
    expect(wrapped()).toBeInstanceOf(String);
    expect(wrapped().val).toBe('result');
  });

  test('function wrapper preserves non-string return', () => {
    const wrapped = markSafe(() => 42);
    expect(wrapped()).toBe(42);
  });
});
