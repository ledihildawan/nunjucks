import { describe, test, expect } from 'bun:test';
import {
  makeComponent,
  makeKeywordArgs,
  getKeywordArgs,
  numArgs,
} from '@nunjucks/runtime/component';

describe('makeKeywordArgs', () => {
  test('adds keywords flag to object', () => {
    const obj = { a: 1 };
    const result = makeKeywordArgs(obj);
    expect(result.a).toBe(1);
    expect(result).not.toBe(obj);
    expect(result.keywords).toBe(true);
  });
});

describe('numArgs', () => {
  test('returns 0 for empty args', () => {
    expect(numArgs([])).toBe(0);
  });

  test('returns count for plain args', () => {
    expect(numArgs([1, 2, 3])).toBe(3);
  });

  test('excludes keyword args from count', () => {
    const args = [1, 2, makeKeywordArgs({ a: 1 })];
    expect(numArgs(args)).toBe(2);
  });
});

describe('getKeywordArgs', () => {
  test('returns empty object for no args', () => {
    expect(getKeywordArgs([])).toEqual({});
  });

  test('returns empty object for plain args', () => {
    expect(getKeywordArgs([1, 2])).toEqual({});
  });

  test('extracts keyword args from last position', () => {
    const kwargs = makeKeywordArgs({ a: 1 });
    expect(getKeywordArgs([1, kwargs])).toEqual({ a: 1, keywords: true });
  });

  test('merges multiple keyword args objects, later wins', () => {
    const first = makeKeywordArgs({ a: 1, name: 'x' });
    const second = makeKeywordArgs({ name: 'y', extra: true });
    expect(getKeywordArgs([1, first, second])).toEqual({
      a: 1,
      name: 'y',
      extra: true,
      keywords: true,
    });
  });
});

describe('makeComponent', () => {
  const add = makeComponent(['a', 'b'], [], (a: number, b: number) => a + b);

  test('calls func with positional args', () => {
    expect((add as (a: number, b: number) => number)(3, 4)).toBe(7);
  });

  test('passes extra args as unnamed kwargs', () => {
    const macro = makeComponent(['a'], ['b'], (a: number, kwargs: { b?: number }) => a + (kwargs.b || 0));
    expect((macro as (a: number, b: number) => number)(1, 2)).toBe(3);
  });

  test('fills missing args from kwargs', () => {
    const fn = makeComponent(['a', 'b'], [], (a: number, b: number, extra: { c?: number }) => a + b + (extra.c || 0));
    const kwargs = makeKeywordArgs({ b: 10 });
    expect((fn as (a: number, kwargs: { b: number }) => number)(5, kwargs)).toBe(15);
  });

  test('extra positional args fill kwarg names', () => {
    const macro = makeComponent(['a'], ['b'], (a: number, kwargs: { b?: number }) => a + (kwargs.b || 0));
    expect((macro as (a: number, b: number) => number)(1, 2)).toBe(3);
  });

  test('preserves this context', () => {
    const macro = makeComponent([], [], function (this: { val: number }) {
      return this.val;
    });
    expect((macro as unknown as () => number).call({ val: 42 })).toBe(42);
  });
});
