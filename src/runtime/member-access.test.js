import { describe, test, expect } from 'bun:test';
import {
  memberLookup, optionalMemberLookup,
  slice, nullishCoalesce,
  isNullAccessResult,
} from './member-access.js';

describe('memberLookup', () => {
  test('returns null marker for null/undefined object', () => {
    const result = memberLookup(null, 'key');
    expect(isNullAccessResult(result)).toBe(true);
    expect(result.__nunjucks_parent__).toBe(null);
    expect(result.__access_path__).toBe('key');
  });

  test('gets property value', () => {
    expect(memberLookup({ a: 1 }, 'a')).toBe(1);
  });

  test('wraps function in call proxy', () => {
    const obj = { fn: (x) => x * 2 };
    const proxy = memberLookup(obj, 'fn');
    expect(proxy(3)).toBe(6);
  });

  test('call proxy preserves this', () => {
    const obj = { name: 'test', getName() { return this.name; } };
    const proxy = memberLookup(obj, 'getName');
    expect(proxy()).toBe('test');
  });

  test('returns callable proxy for missing key that returns undefined when called', () => {
    const result = memberLookup({}, 'missing');
    expect(result()).toBeUndefined();
  });
});

describe('optionalMemberLookup', () => {
  test('returns undefined for null/undefined object', () => {
    expect(optionalMemberLookup(null, 'key')).toBeUndefined();
    expect(optionalMemberLookup(undefined, 'key')).toBeUndefined();
  });

  test('gets property value', () => {
    expect(optionalMemberLookup({ a: 1 }, 'a')).toBe(1);
  });

  test('wraps function in call proxy', () => {
    const obj = { fn: (x) => x * 2 };
    const proxy = optionalMemberLookup(obj, 'fn');
    expect(proxy(3)).toBe(6);
  });
});

describe('slice', () => {
  const arr = [0, 1, 2, 3, 4, 5];

  test('defaults start to 0 when step is positive', () => {
    expect(slice(arr, null, 3, 1)).toEqual([0, 1, 2]);
  });

  test('defaults start to end when step is negative', () => {
    expect(slice(arr, null, null, -1)).toEqual([5, 4, 3, 2, 1, 0]);
  });

  test('defaults stop to length when step is positive', () => {
    expect(slice(arr, 2, null, 1)).toEqual([2, 3, 4, 5]);
  });

  test('defaults stop to -1 when step is negative', () => {
    expect(slice(arr, 3, null, -1)).toEqual([3, 2, 1, 0]);
  });

  test('uses arr.slice for step=1', () => {
    expect(slice(arr, 1, 4, 1)).toEqual([1, 2, 3]);
  });

  test('uses arr.slice for step=null', () => {
    expect(slice(arr, 1, 4, null)).toEqual([1, 2, 3]);
  });

  test('uses arr.slice for step=undefined', () => {
    expect(slice(arr, 1, 4, undefined)).toEqual([1, 2, 3]);
  });

  test('positive step skips elements', () => {
    expect(slice(arr, 0, 6, 2)).toEqual([0, 2, 4]);
  });

  test('negative step reverses', () => {
    expect(slice(arr, 4, 0, -1)).toEqual([4, 3, 2, 1]);
  });

  test('handles negative start', () => {
    expect(slice(arr, -3, 6, 1)).toEqual([3, 4, 5]);
  });

  test('handles negative stop', () => {
    expect(slice(arr, 0, -1, 1)).toEqual([0, 1, 2, 3, 4]);
  });

  test('throws for step=0', () => {
    expect(() => slice(arr, 0, 5, 0)).toThrow('slice: step cannot be zero');
  });

  test('works on strings', () => {
    expect(slice('hello', 1, 4, 1)).toEqual('ell');
  });
});

describe('nullishCoalesce', () => {
  test('returns left when not null/undefined', () => {
    expect(nullishCoalesce(0, 42)).toBe(0);
    expect(nullishCoalesce('', 'default')).toBe('');
    expect(nullishCoalesce(false, true)).toBe(false);
  });

  test('returns right when left is null', () => {
    expect(nullishCoalesce(null, 42)).toBe(42);
  });

  test('returns right when left is undefined', () => {
    expect(nullishCoalesce(undefined, 42)).toBe(42);
  });
});
