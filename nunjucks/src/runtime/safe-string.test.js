import { describe, test, expect } from 'bun:test';
import { SafeString, copySafeness, markSafe } from './safe-string.js';

describe('SafeString', () => {
  test('stores string value and length', () => {
    const s = new SafeString('hello');
    expect(s.val).toBe('hello');
    expect(s.length).toBe(5);
  });

  test('constructor exits early for non-string, val undefined, length from prototype', () => {
    const r = new SafeString(42);
    expect(r).toBeInstanceOf(SafeString);
    expect(r.val).toBeUndefined();
    expect(r.length).toBe(0);
  });

  test('valueOf returns stored value', () => {
    const s = new SafeString('test');
    expect(s.valueOf()).toBe('test');
  });

  test('toString returns stored value', () => {
    const s = new SafeString('test');
    expect(s.toString()).toBe('test');
  });

  test('instanceof String', () => {
    const s = new SafeString('hello');
    expect(s).toBeInstanceOf(String);
    expect(typeof s).toBe('object');
  });
});

describe('copySafeness', () => {
  test('wraps target in SafeString when dest is SafeString', () => {
    const result = copySafeness(new SafeString('original'), 'newval');
    expect(result).toBeInstanceOf(SafeString);
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
    expect(result).toBeInstanceOf(SafeString);
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
    expect(wrapped()).toBeInstanceOf(SafeString);
    expect(wrapped().val).toBe('result');
  });

  test('function wrapper preserves non-string return', () => {
    const wrapped = markSafe(() => 42);
    expect(wrapped()).toBe(42);
  });
});
