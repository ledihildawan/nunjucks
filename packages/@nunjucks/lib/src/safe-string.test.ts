import { describe, expect, test } from 'bun:test';
import { copySafeness, createSafeString, isSafeString, markSafe } from './safe-string.ts';

describe('createSafeString', () => {
  test('wraps a string with val, length, valueOf, and toString', () => {
    const safe = createSafeString('<b>hi</b>');
    expect(safe.val).toBe('<b>hi</b>');
    expect(safe.length).toBe(9);
    expect(safe.valueOf()).toBe('<b>hi</b>');
    expect(safe.toString()).toBe('<b>hi</b>');
    expect(String(safe)).toBe('<b>hi</b>');
  });

  test('passes non-string values through unchanged', () => {
    expect(createSafeString(42)).toBe(42);
    expect(createSafeString(null)).toBe(null);
    const value = { some: 'object' };
    expect(createSafeString(value)).toBe(value);
  });

  test('installs the contract properties as non-enumerable data properties', () => {
    const safe = createSafeString('x') as object;
    for (const key of ['val', 'length', 'valueOf', 'toString']) {
      const descriptor = Object.getOwnPropertyDescriptor(safe, key);
      expect(descriptor?.enumerable).toBe(false);
      expect(descriptor?.get).toBeUndefined();
      expect(descriptor?.set).toBeUndefined();
    }
  });
});

describe('isSafeString', () => {
  test('accepts a SafeString built by createSafeString', () => {
    expect(isSafeString(createSafeString('x'))).toBe(true);
  });

  test('rejects primitives, null, and plain objects', () => {
    expect(isSafeString('x')).toBe(false);
    expect(isSafeString(null)).toBe(false);
    expect(isSafeString({ val: 'x' })).toBe(false);
    expect(isSafeString({})).toBe(false);
  });

  test('rejects a plain context object whose val is enumerable', () => {
    // WHY: the duck-check payload — a context object with a `val` field must not
    // pass structural verification, or it would bypass autoescape downstream.
    const forged = {
      val: '<script>',
      length: 8,
      valueOf: () => '<script>',
      toString: () => '<script>',
    };
    expect(isSafeString(forged)).toBe(false);
  });

  test('rejects a String object without the installed descriptors', () => {
    expect(isSafeString(Object('plain'))).toBe(false);
  });
});

describe('copySafeness', () => {
  test('wraps the target string when the source value is safe', () => {
    const copied = copySafeness(createSafeString('<i>a</i>'), { toString: () => '<i>b</i>' });
    expect(isSafeString(copied)).toBe(true);
    expect(copied.toString()).toBe('<i>b</i>');
  });

  test('returns the plain string when the source value is not safe', () => {
    const copied = copySafeness('plain', { toString: () => '<i>b</i>' });
    expect(copied).toBe('<i>b</i>');
    expect(isSafeString(copied)).toBe(false);
  });
});

describe('markSafe', () => {
  test('marks a string as a SafeString', () => {
    const marked = markSafe('<em>x</em>');
    expect(isSafeString(marked)).toBe(true);
    expect(marked.toString()).toBe('<em>x</em>');
  });

  test('wraps a function so string results come back pre-wrapped', () => {
    const marked = markSafe(() => 'result');
    expect(typeof marked).toBe('function');
    const outcome = (marked as () => unknown)();
    expect(isSafeString(outcome)).toBe(true);
    expect(String(outcome)).toBe('result');
  });

  test('leaves a function non-string result and non-function values untouched', () => {
    const markedFn = markSafe(() => 7);
    expect((markedFn as () => unknown)()).toBe(7);
    expect(markSafe(7)).toBe(7);
  });
});
