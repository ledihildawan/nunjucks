import { describe, test, expect } from 'bun:test';
import {
  callWrap,
  contextOrFrameLookup,
  lookup,
  handleError,
  fromIterator,
  inOperator,
} from './runtime-helpers.ts';

describe('callWrap', () => {
  test('invokes function bound to context with args', () => {
    const fn = function (this: { prefix: string }, a: string, b: string) {
      return this.prefix + a + b;
    };
    expect(callWrap(fn, 'test', 'test()', { prefix: 'r:' }, ['x', 'y'])).toBe('r:xy');
  });

  test('allows slot keyword', () => {
    const fn = () => 'result';
    expect(callWrap(fn, 'slot', 'slot()', {}, [])).toBe('result');
  });

  test('throws RESERVED_KEYWORD_CONTEXT for "super"', () => {
    expect(() => callWrap(() => 1, 'super', 'super()', {}, [])).toThrow('reserved keyword');
  });

  test('throws NULL_VALUE for null/undefined obj', () => {
    expect(() => callWrap(null, 'foo', 'foo()', {}, [], 1, 2)).toThrow("Cannot access 'foo' on null");
    try {
      callWrap(undefined, 'foo', 'foo()', {}, [], 1, 2);
    } catch (e) {
      expect((e as { code: string }).code).toBe('NULL_VALUE');
    }
  });

  test('throws NOT_A_FUNCTION for non-function obj', () => {
    expect(() => callWrap(42, 'bar', 'bar()', {}, [], 1, 2)).toThrow('not a function');
    try {
      callWrap('nope', 'bar', 'bar()', {}, [], 1, 2);
    } catch (e) {
      expect((e as { code: string }).code).toBe('NOT_A_FUNCTION');
    }
  });

  test('uses displayName in NOT_A_FUNCTION error', () => {
    expect(() => callWrap(42, 'internal', 'prettyName()', {}, [], 1, 2)).toThrow("'prettyName()'");
  });
});

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

describe('lookup', () => {
  test('returns default when ctx is null', () => {
    expect(lookup(null, 'x')).toBeUndefined();
    expect(lookup(null, 'x', 'def')).toBe('def');
  });

  test('uses ctx.lookup function when present', () => {
    const ctx = { lookup: (k: string) => {
      if (k === 'a') {
        return 1;
      }
    } };
    expect(lookup(ctx, 'a')).toBe(1);
  });

  test('returns default when ctx.lookup returns undefined', () => {
    const ctx = { lookup: () => undefined };
    expect(lookup(ctx, 'a', 'def')).toBe('def');
  });

  test('falls back to bracket access when no lookup function', () => {
    const ctx = { a: 99 } as Record<string, unknown>;
    expect(lookup(ctx, 'a')).toBe(99);
  });

  test('returns default for missing key via bracket access', () => {
    const ctx = {} as Record<string, unknown>;
    expect(lookup(ctx, 'missing', 'def')).toBe('def');
  });
});

describe('handleError', () => {
  test('rethrows an error that already has lineno', () => {
    const err = new Error('test') as Error & { lineno?: number };
    err.lineno = 5;
    expect(() => handleError(err, 1, 2)).toThrow(err);
  });

  test('attaches lineno/colno to the normalized error', () => {
    try {
      handleError(new Error('boom'), 3, 7);
      throw new Error('expected handleError to throw');
    } catch (e) {
      expect((e as { lineno: number }).lineno).toBe(3);
      expect((e as { colno: number }).colno).toBe(7);
    }
  });

  test('preserves code and subject from original error', () => {
    const err = new Error('x') as Error & { code?: string; subject?: string };
    err.code = 'MY_CODE';
    err.subject = 'myVar';
    try {
      handleError(err, 1, 2);
    } catch (e) {
      expect((e as { code: string }).code).toBe('MY_CODE');
      expect((e as { subject: string }).subject).toBe('myVar');
    }
  });

  test('normalizes primitive thrown values', () => {
    for (const value of ['boom', 42, null, undefined]) {
      try {
        handleError(value, 3, 7);
      } catch (e) {
        expect((e as { code: string }).code).toBe('RUNTIME_ERROR');
        expect((e as { lineno: number }).lineno).toBe(3);
      }
    }
  });

  test('handles frozen errors without mutating the original', () => {
    const error = Object.freeze(new Error('frozen'));
    try {
      handleError(error, 2, 4);
    } catch (normalized) {
      expect((normalized as Error).message).toBe('frozen');
      expect((normalized as { lineno: number }).lineno).toBe(2);
    }
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

describe('inOperator', () => {
  test('checks array membership', () => {
    expect(inOperator(2, [1, 2, 3])).toBe(true);
    expect(inOperator(4, [1, 2, 3])).toBe(false);
  });

  test('checks string membership', () => {
    expect(inOperator('o', 'hello')).toBe(true);
    expect(inOperator('z', 'hello')).toBe(false);
  });

  test('checks object key presence', () => {
    expect(inOperator('name', { name: 'alice' })).toBe(true);
    expect(inOperator('age', { name: 'alice' })).toBe(false);
  });

  test('throws for unsupported right-hand types', () => {
    expect(() => inOperator('x', 42)).toThrow("Cannot use 'in' operator");
    expect(() => inOperator('x', null)).toThrow();
  });

  test('preserves location info on the thrown error', () => {
    try {
      inOperator('x', 42, 3, 7);
    } catch (e) {
      expect((e as { code: string }).code).toBe('IN_OPERATOR');
      expect((e as { lineno: number }).lineno).toBe(3);
      expect((e as { colno: number }).colno).toBe(7);
      return;
    }
    throw new Error('expected inOperator to throw');
  });
});
