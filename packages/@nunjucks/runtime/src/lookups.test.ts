import { describe, test, expect } from 'bun:test';
import { contextOrFrameLookup, fromIterator } from './lookups.ts';

describe('contextOrFrameLookup', () => {
  test('prefers frame value when defined', () => {
    const frame = { lookup: () => 'from_frame' };
    const context = { lookup: () => 'from_context' };
    expect(contextOrFrameLookup(context as never, frame as never, 'x')).toBe('from_frame');
  });

  test('falls back to context when frame returns undefined', () => {
    const frame = { lookup: () => undefined };
    const context = { lookup: () => 'from_context' };
    expect(contextOrFrameLookup(context as never, frame as never, 'x')).toBe('from_context');
  });

  test('returns undefined when neither has the key', () => {
    const frame = { lookup: () => undefined };
    const context = { lookup: () => undefined };
    expect(contextOrFrameLookup(context as never, frame as never, 'x')).toBeUndefined();
  });
});

describe('fromIterator', () => {
  test('returns arrays unchanged', () => {
    const arr = [1, 2, 3];
    expect(fromIterator(arr)).toBe(arr);
  });

  test('converts iterables to arrays', () => {
    expect(fromIterator(new Set([1, 2, 3]))).toEqual([1, 2, 3]);
    expect(fromIterator(new Map([['a', 1]]))).toEqual([['a', 1]]);
  });

  test('returns non-iterable objects unchanged', () => {
    const obj = { a: 1 };
    expect(fromIterator(obj)).toBe(obj);
  });

  test('returns null/undefined/primitives unchanged', () => {
    expect(fromIterator(null)).toBeNull();
    expect(fromIterator(undefined)).toBeUndefined();
    expect(fromIterator(42)).toBe(42);
  });
});
