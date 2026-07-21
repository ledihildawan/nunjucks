import { describe, test, expect } from 'bun:test';
import {
  makeMacro,
  makeKeywordArgs,
  isKeywordArgs,
  getKeywordArgs,
  numArgs,
  withKwargs,
} from '@nunjucks/runtime/macro';

describe('makeKeywordArgs', () => {
  test('adds __keywords flag to object', () => {
    const obj = { a: 1 };
    const result = makeKeywordArgs(obj);
    expect(result as unknown as { a: number }).toBe(obj);
    expect(result.__keywords).toBe(true);
  });
});

describe('isKeywordArgs', () => {
  test('returns true for keyword args object', () => {
    expect(isKeywordArgs(makeKeywordArgs({}))).toBe(true);
  });

  test('returns false for plain object', () => {
    expect(isKeywordArgs({})).toBe(false);
  });

  test('returns null for null input (short-circuit)', () => {
    expect(isKeywordArgs(null)).toBeNull();
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
    expect(getKeywordArgs([1, kwargs])).toBe(kwargs);
  });
});

describe('makeMacro', () => {
  const add = makeMacro(['a', 'b'], [], (a: number, b: number) => a + b);

  test('calls func with positional args', () => {
    expect((add as (a: number, b: number) => number)(3, 4)).toBe(7);
  });

  test('passes extra args as unnamed kwargs', () => {
    const macro = makeMacro(['a'], ['b'], (a: number, kwargs: { b?: number }) => a + (kwargs.b || 0));
    expect((macro as (a: number, b: number) => number)(1, 2)).toBe(3);
  });

  test('fills missing args from kwargs', () => {
    const macro = makeMacro(['a', 'b'], [], (a: number, b: number, kwargs: { c?: number }) => a + b + (kwargs.c || 0));
    const kwargs = makeKeywordArgs({ b: 10 });
    expect((macro as (a: number, kwargs: { b: number }) => number)(5, kwargs)).toBe(15);
  });

  test('extra positional args fill kwarg names', () => {
    const macro = makeMacro(['a'], ['b'], (a: number, kwargs: { b?: number }) => a + (kwargs.b || 0));
    expect((macro as (a: number, b: number) => number)(1, 2)).toBe(3);
  });

  test('preserves this context', () => {
    const macro = makeMacro([], [], function (this: { val: number }) {
      return this.val;
    });
    expect((macro as unknown as () => number).call({ val: 42 })).toBe(42);
  });
});

describe('withKwargs', () => {
  test('wraps function to handle kwargs correctly', () => {
    const greet = withKwargs(({ name = 'World', greeting = 'Hello' }: { name?: string; greeting?: string } = {}) => {
      return `${greeting} ${name}!`;
    });
    expect((greet as (kw: unknown) => string)(makeKeywordArgs({ name: 'John' }))).toBe('Hello John!');
  });

  test('handles kwargs in any order', () => {
    const greet = withKwargs(({ name = 'World', greeting = 'Hello' }: { name?: string; greeting?: string } = {}) => {
      return `${greeting} ${name}!`;
    });
    expect((greet as (kw: unknown) => string)(makeKeywordArgs({ greeting: 'Hi', name: 'Alice' }))).toBe('Hi Alice!');
  });

  test('passes positional args before kwargs', () => {
    const format = withKwargs((a: string, b: string, { sep = '-' }: { sep?: string } = {}) => {
      return `${a}${sep}${b}`;
    });
    expect((format as (a: string, b: string, kw: unknown) => string)('X', 'Y', makeKeywordArgs({ sep: '::' }))).toBe('X::Y');
  });

  test('uses defaults when kwargs not provided', () => {
    const greet = withKwargs(({ name = 'World', greeting = 'Hello' }: { name?: string; greeting?: string } = {}) => {
      return `${greeting} ${name}!`;
    });
    expect((greet as (kw: unknown) => string)(makeKeywordArgs({}))).toBe('Hello World!');
  });

  test('preserves this context', () => {
    const greet = withKwargs(function (this: { greeting: string }, { name = 'World' }: { name?: string } = {}) {
      return `${this.greeting} ${name}!`;
    });
    const obj = { greeting: 'Hi', greet: greet as (kw: unknown) => string };
    expect(obj.greet(makeKeywordArgs({ name: 'Bob' }))).toBe('Hi Bob!');
  });

  test('handles only positional args', () => {
    const add = withKwargs((a: number, b: number, { multiplier = 1 }: { multiplier?: number } = {}) => {
      return (a + b) * multiplier;
    });
    expect((add as (a: number, b: number, kw: unknown) => number)(1, 2, makeKeywordArgs({ multiplier: 10 }))).toBe(30);
  });
});
