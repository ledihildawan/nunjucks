import { describe, test, expect } from 'bun:test';
import {
  suppressValue,
  awaitValue,
  ensureDefined,
  callWrap,
  contextOrFrameLookup,
  lookup,
  handleError,
  fromIterator,
  inOperator,
} from './helpers.ts';
import { createSafeString } from './safe-string.ts';

const propNotFound = (path = 'x', parent = 'obj') => ({
  __nunjucks_prop_not_found__: true,
  __nunjucks_parent__: parent,
  __access_path__: path,
});

const nullAccess = (path = 'x', parent = 'obj') => ({
  __nunjucks_null__: true,
  __nunjucks_parent__: parent,
  __access_path__: path,
});

describe('suppressValue', () => {
  test('returns empty string for null and undefined', () => {
    expect(suppressValue(null)).toBe('');
    expect(suppressValue(undefined)).toBe('');
  });

  test('returns value unchanged when autoescape is falsy', () => {
    expect(suppressValue('hello', false)).toBe('hello');
    expect(suppressValue(42, false)).toBe(42);
    expect(suppressValue(false, false)).toBe(false);
  });

  test('escapes HTML entities when autoescape is true', () => {
    expect(suppressValue('<script>', true)).toBe('&lt;script&gt;');
  });

  test('escapes all special characters', () => {
    expect(suppressValue('a&b<c>d"e\'f\\g', true)).toBe(
      'a&amp;b&lt;c&gt;d&quot;e&#39;f&#92;g',
    );
  });

  test('coerces non-string to string when autoescaping', () => {
    expect(suppressValue(42, true)).toBe('42');
  });

  test('does not double-escape SafeString', () => {
    const safe = createSafeString('<b>bold</b>');
    expect(suppressValue(safe, true)).toBe(safe);
  });

  test('resolves promises and suppresses the resolved value', async () => {
    expect(await suppressValue(Promise.resolve('hi'), false)).toBe('hi');
    expect(await suppressValue(Promise.resolve(null), false)).toBe('');
  });

  test('resolves promises with autoescape applied to the resolved value', async () => {
    expect(await suppressValue(Promise.resolve('<a>'), true)).toBe('&lt;a&gt;');
  });
});

describe('awaitValue', () => {
  test('returns non-promise values unchanged', () => {
    expect(awaitValue(42)).toBe(42);
    expect(awaitValue('hi')).toBe('hi');
    expect(awaitValue(null)).toBeNull();
    expect(awaitValue(undefined)).toBeUndefined();
  });

  test('resolves a promise to its value', async () => {
    expect(await awaitValue(Promise.resolve(99))).toBe(99);
  });
});

describe('ensureDefined', () => {
  test('returns defined falsy values unchanged', () => {
    expect(ensureDefined(0)).toBe(0);
    expect(ensureDefined(false)).toBe(false);
    expect(ensureDefined('')).toBe('');
  });

  test('returns other defined values unchanged', () => {
    expect(ensureDefined('x')).toBe('x');
    expect(ensureDefined(42)).toBe(42);
  });

  test('returns "undefined" string for null in chainable mode (default)', () => {
    expect(ensureDefined(null, 1, 2)).toBe('undefined');
    expect(ensureDefined(undefined, 1, 2)).toBe('undefined');
  });

  test('throws in strict mode for null/undefined', () => {
    expect(() => ensureDefined(null, 1, 2, null, null, 'strict')).toThrow('Undefined value');
    expect(() => ensureDefined(undefined, 1, 2, null, null, 'strict')).toThrow('Undefined value');
  });

  test('includes varName in strict error message', () => {
    expect(() => ensureDefined(null, 1, 2, 'myVar', null, 'strict')).toThrow("'myVar'");
  });

  test('sets UNDEFINED_VARIABLE code with varName, UNDEFINED_VALUE without', () => {
    try {
      ensureDefined(null, 1, 2, 'x', null, 'strict');
    } catch (e) {
      expect((e as { code: string }).code).toBe('UNDEFINED_VARIABLE');
    }
    try {
      ensureDefined(undefined, 1, 2, null, null, 'strict');
    } catch (e) {
      expect((e as { code: string }).code).toBe('UNDEFINED_VALUE');
    }
  });

  test('collects debug warnings when __warnings__ array is present', () => {
    const warnings: unknown[] = [];
    const result = ensureDefined.call({ __warnings__: warnings }, undefined, 1, 2, 'v', null, 'debug');
    expect(result).toBe('undefined');
    expect(warnings).toHaveLength(1);
  });

  test('prints to console.warn in debug mode when no collector exists', () => {
    const original = console.warn;
    let calls = 0;
    console.warn = () => { calls += 1; };
    try {
      expect(ensureDefined(undefined, 1, 2, 'v', null, 'debug')).toBe('undefined');
    } finally {
      console.warn = original;
    }
    expect(calls).toBe(1);
  });

  test('handles property-not-found result in chainable mode', () => {
    expect(ensureDefined(propNotFound('name', 'user'), 1, 2)).toBe('undefined');
  });

  test('throws UNDEFINED_PROPERTY in strict mode for property-not-found result', () => {
    expect(() => ensureDefined(propNotFound('name', 'user'), 1, 2, null, null, 'strict')).toThrow(
      "Property 'name' not found",
    );
    try {
      ensureDefined(propNotFound('name', 'user'), 1, 2, null, null, 'strict');
    } catch (e) {
      expect((e as { code: string }).code).toBe('UNDEFINED_PROPERTY');
    }
  });

  test('handles null-access result in chainable mode', () => {
    expect(ensureDefined(nullAccess('name', 'user'), 1, 2)).toBe('undefined');
  });

  test('throws NULL_VALUE in strict mode for null-access result', () => {
    expect(() => ensureDefined(nullAccess('name', 'user'), 1, 2, null, null, 'strict')).toThrow(
      "Cannot access 'name' on null",
    );
    try {
      ensureDefined(nullAccess('name', 'user'), 1, 2, null, null, 'strict');
    } catch (e) {
      expect((e as { code: string }).code).toBe('NULL_VALUE');
    }
  });

  test('derives parent name from dotted varName for property-not-found in strict mode', () => {
    const markerWithoutParent = {
      __nunjucks_prop_not_found__: true,
      __access_path__: 'x',
    };
    expect(() =>
      ensureDefined(markerWithoutParent, 1, 2, 'user.profile', null, 'strict'),
    ).toThrow("in 'user'");
  });
});

describe('callWrap', () => {
  test('invokes function bound to context with args', () => {
    const fn = function (this: { prefix: string }, a: string, b: string) {
      return this.prefix + a + b;
    };
    expect(callWrap(fn, 'test', 'test()', { prefix: 'r:' }, ['x', 'y'])).toBe('r:xy');
  });

  test('throws RESERVED_KEYWORD_CONTEXT for "caller"', () => {
    expect(() => callWrap(() => 1, 'caller', 'caller()', {}, [])).toThrow('reserved keyword');
    try {
      callWrap(() => 1, 'caller', 'caller()', {}, []);
    } catch (e) {
      expect((e as { code: string }).code).toBe('RESERVED_KEYWORD_CONTEXT');
    }
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
