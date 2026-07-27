import { describe, test, expect } from 'bun:test';
import {
  suppressValue,
  awaitValue,
  ensureDefined,
  callWrap,
  contextOrFrameLookup,
  handleError,
  fromIterator,
  inOperator,
  createSafeString,
} from '@nunjucks/runtime';

describe('suppressValue', () => {
  test('returns empty string for null/undefined', () => {
    expect(suppressValue(null)).toBe('');
    expect(suppressValue(undefined)).toBe('');
  });

  test('returns value as-is when autoescape is false', () => {
    expect(suppressValue('hello', false)).toBe('hello');
  });

  test('escapes when autoescape is true', () => {
    const result = suppressValue('<script>', true) as string;
    expect(result).toContain('&lt;');
  });

  test('does not double-escape SafeString', () => {
    const safe = createSafeString('<b>bold</b>');
    expect(suppressValue(safe, true)).toBe(safe);
  });

  test('resolves promises', async () => {
    const result = await suppressValue(Promise.resolve('hello'), false);
    expect(result).toBe('hello');
  });
});

describe('awaitValue', () => {
  test('returns non-promise as-is', () => {
    expect(awaitValue(42)).toBe(42);
    expect(awaitValue('hello')).toBe('hello');
  });

  test('resolves promise', async () => {
    const result = await awaitValue(Promise.resolve(99));
    expect(result).toBe(99);
  });
});

describe('ensureDefined', () => {
  test('returns value if defined', () => {
    expect(ensureDefined(0)).toBe(0);
    expect(ensureDefined(false)).toBe(false);
    expect(ensureDefined('')).toBe('');
  });

  test('throws for null/undefined in strict mode', () => {
    expect(() => ensureDefined(null, 1, 2, null, null, 'strict')).toThrow('Undefined value');
    expect(() => ensureDefined(undefined, 1, 2, null, null, 'strict')).toThrow('Undefined value');
  });

  test('returns undefined string in chainable mode (default)', () => {
    expect(ensureDefined(null, 1, 2)).toBe('undefined');
    expect(ensureDefined(undefined, 1, 2)).toBe('undefined');
  });

  test('returns undefined string in debug mode', () => {
    const warnings: unknown[] = [];
    expect(
      ensureDefined.call({ __warnings__: warnings }, null, 1, 2, null, null, 'debug'),
    ).toBe('undefined');
    expect(
      ensureDefined.call({ __warnings__: warnings }, undefined, 1, 2, null, null, 'debug'),
    ).toBe('undefined');
    expect(warnings).toHaveLength(2);
  });

  test('collects debug warnings without duplicate console output', () => {
    const warnings: unknown[] = [];
    // biome-ignore lint/suspicious/noConsole: the test stubs console.warn to assert the fallback path, so it has to reference it.
    const originalWarn = console.warn;
    let calls = 0;
    console.warn = () => {
      calls += 1;
    };
    try {
      expect(
        ensureDefined.call({ __warnings__: warnings }, undefined, 1, 2, 'value', 'inline', 'debug'),
      ).toBe('undefined');
    } finally {
      console.warn = originalWarn;
    }
    expect(calls).toBe(0);
    expect(warnings).toHaveLength(1);
  });

  test('prints debug warnings when no collector exists', () => {
    // biome-ignore lint/suspicious/noConsole: the test stubs console.warn to assert the fallback path, so it has to reference it.
    const originalWarn = console.warn;
    let calls = 0;
    console.warn = () => {
      calls += 1;
    };
    try {
      ensureDefined(undefined, 1, 2, 'value', 'inline', 'debug');
    } finally {
      console.warn = originalWarn;
    }
    expect(calls).toBe(1);
  });
  test('includes varName in error message (strict mode)', () => {
    expect(() => ensureDefined(null, 1, 2, 'myVar', null, 'strict')).toThrow("'myVar'");
  });

  test('sets code UNDEFINED_VARIABLE with varName in strict mode', () => {
    try {
      ensureDefined(null, 1, 2, 'x', null, 'strict');
    } catch (e) {
      expect((e as { code: string }).code).toBe('UNDEFINED_VARIABLE');
    }
  });

  test('sets code UNDEFINED_VALUE without varName in strict mode', () => {
    try {
      ensureDefined(undefined, 1, 2, null, null, 'strict');
    } catch (e) {
      expect((e as { code: string }).code).toBe('UNDEFINED_VALUE');
    }
  });

  test('error has phase render in strict mode', () => {
    try {
      ensureDefined(null, 1, 2, null, null, 'strict');
    } catch (e) {
      expect((e as { phase: string }).phase).toBe('render');
    }
  });
});

describe('callWrap', () => {
  test('calls function with context and args', () => {
    const fn = function (this: { prefix: string }, a: string, b: string) {
      return this.prefix + a + b;
    };
    const ctx = { prefix: 'r:' };
    expect(callWrap(fn, 'test', 'test()', ctx, ['x', 'y'])).toBe('r:xy');
  });

  test('throws NULL_VALUE for null/undefined obj', () => {
    expect(() => callWrap(null, 'foo', 'foo()', {}, [], 1, 2)).toThrow("Cannot access 'foo' on null");
    try {
      callWrap(null, 'foo', 'foo()', {}, [], 1, 2);
    } catch (e) {
      expect((e as { code: string }).code).toBe('NULL_VALUE');
    }
  });

  test('throws NOT_A_FUNCTION for non-function', () => {
    expect(() => callWrap(42, 'bar', 'bar()', {}, [], 1, 2)).toThrow('not a function');
    try {
      callWrap(42, 'bar', 'bar()', {}, [], 1, 2);
    } catch (e) {
      expect((e as { code: string }).code).toBe('NOT_A_FUNCTION');
    }
  });
});

describe('contextOrFrameLookup', () => {
  test('prefers frame lookup', () => {
    const frame = { lookup: () => 'from_frame' };
    const context = { lookup: () => 'from_context' };
    expect(contextOrFrameLookup(context as never, frame as never, 'x')).toBe('from_frame');
  });

  test('falls back to context lookup', () => {
    const frame = { lookup: () => undefined };
    const context = { lookup: () => 'from_context' };
    expect(contextOrFrameLookup(context as never, frame as never, 'x')).toBe('from_context');
  });
});

describe('handleError', () => {
  test('throws error unchanged if it has lineno', () => {
    const err = new Error('test') as Error & { lineno?: number };
    err.lineno = 5;
    expect(() => handleError(err, 1, 2)).toThrow(err);
  });

  test('throws error with lineno/colno', () => {
    const err = new Error('test');
    expect(() => handleError(err, 3, 7)).toThrow();
    try {
      handleError(err, 3, 7);
    } catch (e) {
      expect((e as { lineno: number }).lineno).toBe(3);
      expect((e as { colno: number }).colno).toBe(7);
    }
  });

  test('preserves error code and subject', () => {
    const err = new Error('test') as Error & { code?: string; subject?: string };
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
      } catch (error) {
        expect((error as { lineno: number }).lineno).toBe(3);
        expect((error as { colno: number }).colno).toBe(7);
        expect((error as { code: string }).code).toBe('RUNTIME_ERROR');
      }
    }
  });

  test('handles frozen errors without mutating them', () => {
    const error = Object.freeze(new Error('frozen'));
    try {
      handleError(error, 2, 4);
    } catch (normalized) {
      expect((normalized as Error).message).toBe('frozen');
      expect((normalized as { lineno: number }).lineno).toBe(2);
      expect((normalized as { colno: number }).colno).toBe(4);
    }
  });
});

describe('fromIterator', () => {
  test('returns array as-is', () => {
    const arr = [1, 2, 3];
    expect(fromIterator(arr)).toBe(arr);
  });

  test('converts iterable to array', () => {
    const set = new Set([1, 2, 3]);
    expect(fromIterator(set)).toEqual([1, 2, 3]);
  });

  test('returns non-iterable object as-is', () => {
    const obj = { a: 1 };
    expect(fromIterator(obj)).toBe(obj);
  });

  test('returns null/undefined as-is', () => {
    expect(fromIterator(null)).toBeNull();
    expect(fromIterator(undefined)).toBeUndefined();
  });
});

describe('inOperator', () => {
  test('checks array inclusion', () => {
    expect(inOperator(2, [1, 2, 3])).toBe(true);
    expect(inOperator(4, [1, 2, 3])).toBe(false);
  });

  test('checks string inclusion', () => {
    expect(inOperator('o', 'hello')).toBe(true);
    expect(inOperator('x', 'hello')).toBe(false);
  });

  test('checks object key', () => {
    expect(inOperator('name', { name: 'alice' })).toBe(true);
    expect(inOperator('age', { name: 'alice' })).toBe(false);
  });

  test('throws for unexpected types', () => {
    expect(() => inOperator('x', 42)).toThrow("Cannot use 'in' operator to search for 'x' in number");
  });

  test('preserves provided location on unexpected types', () => {
    try {
      inOperator('x', 42, 3, 7);
    } catch (e) {
      expect((e as { code: string }).code).toBe('IN_OPERATOR');
      expect((e as { lineno: number }).lineno).toBe(3);
      expect((e as { colno: number }).colno).toBe(7);
      expect((e as { lineBase: string }).lineBase).toBe('zero');
      return;
    }
    throw new Error('Expected inOperator to throw');
  });
});
