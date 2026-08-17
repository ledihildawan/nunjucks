import { describe, expect, test } from 'bun:test';
import { createComponent, createKeywordArgs, getKeywordArgs, numArgs } from './component.ts';

describe('createKeywordArgs', () => {
  test('adds keywords flag to object', () => {
    const obj = { a: 1 };
    const result = createKeywordArgs(obj);
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
    const args = [1, 2, createKeywordArgs({ a: 1 })];
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
    const kwargs = createKeywordArgs({ a: 1 });
    expect(getKeywordArgs([1, kwargs])).toEqual({ a: 1, keywords: true });
  });

  test('merges multiple keyword args objects, later wins', () => {
    const first = createKeywordArgs({ a: 1, name: 'x' });
    const second = createKeywordArgs({ name: 'y', extra: true });
    expect(getKeywordArgs([1, first, second])).toEqual({
      a: 1,
      name: 'y',
      extra: true,
      keywords: true,
    });
  });

  test('merges kwargs with define-own semantics — __proto__ stays an own property', () => {
    // WHY: JSON.parse creates __proto__ as an own property (no [[Set]] side effect),
    // which is exactly the shape a hostile template-authored kwargs object would present.
    const malicious = createKeywordArgs(
      JSON.parse('{"__proto__": {"polluted": true}}') as Record<string, unknown>
    );
    const merged = getKeywordArgs([malicious]);
    expect(Object.hasOwn(merged, '__proto__')).toBe(true);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});

describe('createComponent', () => {
  const add = createComponent({
    argNames: ['a', 'b'],
    kwargNames: [],
    func: (a: number, b: number) => a + b,
  });

  test('calls func with positional args', () => {
    expect((add as (a: number, b: number) => number)(3, 4)).toBe(7);
  });

  test('passes extra args as unnamed kwargs', () => {
    const macro = createComponent({
      argNames: ['a'],
      kwargNames: ['b'],
      func: (a: number, kwargs: { b?: number }) => a + (kwargs.b || 0),
    });
    expect((macro as (a: number, b: number) => number)(1, 2)).toBe(3);
  });

  test('fills missing args from kwargs', () => {
    const fn = createComponent({
      argNames: ['a', 'b'],
      kwargNames: [],
      func: (a: number, b: number, extra: { c?: number }) => a + b + (extra.c || 0),
    });
    const kwargs = createKeywordArgs({ b: 10 });
    const invokeWithKwargs = fn as (a: number, kwargs: unknown) => number;
    expect(invokeWithKwargs(5, kwargs)).toBe(15);
  });

  test('extra positional args fill kwarg names', () => {
    const macro = createComponent({
      argNames: ['a'],
      kwargNames: ['b'],
      func: (a: number, kwargs: { b?: number }) => a + (kwargs.b || 0),
    });
    expect((macro as (a: number, b: number) => number)(1, 2)).toBe(3);
  });

  test('preserves this context', () => {
    const macro = createComponent({
      argNames: [],
      kwargNames: [],
      func: function (this: { val: number }) {
        return this.val;
      },
    });
    expect((macro as unknown as () => number).call({ val: 42 })).toBe(42);
  });
});
