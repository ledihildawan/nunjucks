import { describe, test, expect } from 'bun:test';
import {
  memberLookup,
  optionalMemberLookup,
  slice,
  nullishCoalesce,
  isNullAccessResult,
  isPropertyNotFoundResult,
  getNullParentName,
  NULL_MARKER,
  PARENT_NAME,
  ACCESS_PATH,
  PROP_NOT_FOUND,
} from './member-access.ts';

describe('memberLookup', () => {
  test('returns value for existing string key', () => {
    const target = { name: 'Alice', age: 30 };
    expect(memberLookup(target, 'name')).toBe('Alice');
    expect(memberLookup(target, 'age')).toBe(30);
  });

  test('returns NullAccessResult when target is null', () => {
    const result = memberLookup(null, 'name') as Record<string, unknown>;
    expect(isNullAccessResult(result)).toBe(true);
    expect(result[NULL_MARKER]).toBe(true);
    expect(result[ACCESS_PATH]).toBe('name');
  });

  test('returns NullAccessResult when target is undefined', () => {
    const result = memberLookup(undefined, 'prop') as Record<string, unknown>;
    expect(isNullAccessResult(result)).toBe(true);
    expect(result[ACCESS_PATH]).toBe('prop');
  });

  test('carries parentName into NullAccessResult', () => {
    const result = memberLookup(null, 'child', 'parent') as Record<string, unknown>;
    expect(result[PARENT_NAME]).toBe('parent');
  });

  test('returns PropertyNotFoundResult callable for missing own property', () => {
    const result = memberLookup({ a: 1 }, 'missing') as Record<string, unknown>;
    expect(isPropertyNotFoundResult(result)).toBe(true);
    expect(result[PROP_NOT_FOUND]).toBe(true);
    expect(typeof result).toBe('function');
    expect((result as unknown as () => unknown)()).toBeUndefined();
  });

  test('PropertyNotFoundResult callable has null prototype', () => {
    const result = memberLookup({}, 'x') as unknown;
    expect(Object.getPrototypeOf(result)).toBeNull();
  });

  test('detects inherited properties via `in` operator on object target', () => {
    class Alive { aliveMethod() { return 'inherited'; } }
    const target = new Alive();
    const result = memberLookup(target, 'aliveMethod');
    expect(typeof result).toBe('function');
  });

  test('wraps function values with bound apply on the owning record', () => {
    const target = { who: 'world', greet() { return `hi ${this.who}`; } };
    const fn = memberLookup(target, 'greet') as (...args: unknown[]) => unknown;
    expect(typeof fn).toBe('function');
    expect(fn()).toBe('hi world');
  });
});

describe('optionalMemberLookup', () => {
  test('returns the value when property exists', () => {
    expect(optionalMemberLookup({ x: 42 }, 'x')).toBe(42);
  });

  test('returns undefined for NullAccessResult', () => {
    expect(optionalMemberLookup(null, 'x')).toBeUndefined();
  });

  test('returns undefined for PropertyNotFoundResult', () => {
    expect(optionalMemberLookup({}, 'missing')).toBeUndefined();
  });

  test('passes parentName through', () => {
    expect(optionalMemberLookup({ a: 1 }, 'a', 'ctx')).toBe(1);
  });
});

describe('isNullAccessResult / isPropertyNotFoundResult', () => {
  test('isNullAccessResult rejects primitives and null', () => {
    expect(isNullAccessResult(null)).toBe(false);
    expect(isNullAccessResult(undefined)).toBe(false);
    expect(isNullAccessResult('str')).toBe(false);
    expect(isNullAccessResult(42)).toBe(false);
  });

  test('isPropertyNotFoundResult rejects plain objects', () => {
    expect(isPropertyNotFoundResult({})).toBe(false);
    expect(isPropertyNotFoundResult(null)).toBe(false);
  });
});

describe('getNullParentName', () => {
  test('extracts parent name from a NullAccessResult', () => {
    const result = memberLookup(null, 'field', 'root');
    expect(getNullParentName(result)).toBe('root');
  });

  test('returns null for nullish input', () => {
    expect(getNullParentName(null)).toBeNull();
    expect(getNullParentName(undefined)).toBeNull();
  });

  test('returns null when marker is absent', () => {
    expect(getNullParentName({ other: 'shape' })).toBeNull();
  });
});

describe('slice', () => {
  test('throws on zero step', () => {
    expect(() => slice({ source: [1, 2, 3], start: 0, stop: 2, step: 0 })).toThrow();
  });

  test('basic slice with step=1 returns a shallow copy subrange', () => {
    expect(slice({ source: [1, 2, 3, 4, 5], start: 1, stop: 4, step: 1 })).toEqual([2, 3, 4]);
    expect(slice({ source: [1, 2, 3, 4, 5], start: 0, stop: 5, step: null })).toEqual([1, 2, 3, 4, 5]);
  });

  test('works on strings', () => {
    expect(slice({ source: 'hello world', start: 0, stop: 5, step: 1 })).toBe('hello');
    expect(slice({ source: 'hello', start: 1, stop: null, step: null })).toBe('ello');
  });

  test('clamps negative start index from the end', () => {
    expect(slice({ source: [1, 2, 3, 4, 5], start: -2, stop: null, step: 1 })).toEqual([4, 5]);
  });

  test('clamps negative stop index from the end', () => {
    expect(slice({ source: [1, 2, 3, 4, 5], start: 0, stop: -1, step: 1 })).toEqual([1, 2, 3, 4]);
  });

  test('forward step skips elements', () => {
    expect(slice({ source: [1, 2, 3, 4, 5, 6], start: 0, stop: 6, step: 2 })).toEqual([1, 3, 5]);
  });

  test('backward step reverses from the start index down to stop', () => {
    expect(slice({ source: [1, 2, 3, 4, 5], start: 4, stop: 0, step: -1 })).toEqual([5, 4, 3, 2]);
  });

  test('null start with negative step resolves to last element', () => {
    expect(slice({ source: [1, 2, 3], start: null, stop: null, step: -1 })).toEqual([3, 2, 1]);
  });

  test('null stop with negative step resolves to index -1 (excluded)', () => {
    expect(slice({ source: [1, 2, 3, 4], start: 3, stop: null, step: -2 })).toEqual([4, 2]);
  });

  test('returns empty array when range is empty', () => {
    expect(slice({ source: [1, 2, 3], start: 2, stop: 2, step: 1 })).toEqual([]);
  });
});

describe('nullishCoalesce', () => {
  test('returns left when non-nullish (including falsy non-nullish values)', () => {
    expect(nullishCoalesce('left', 'fallback')).toBe('left');
    const numericLeft: number | null = 0;
    expect(nullishCoalesce(numericLeft, -1)).toBe(0);
    const booleanLeft: boolean | null = false;
    expect(nullishCoalesce(booleanLeft, true)).toBe(false);
  });

  test('returns right when left is null or undefined', () => {
    expect(nullishCoalesce(null, 'fallback')).toBe('fallback');
    expect(nullishCoalesce(undefined, 'fallback')).toBe('fallback');
  });

  test('preserves generic type inference', () => {
    const value: number | null = 7;
    expect(nullishCoalesce(value, 0)).toBe(7);
  });
});
