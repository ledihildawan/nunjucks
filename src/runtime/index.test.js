import { describe, test, expect } from 'bun:test';
import {
  suppressValue, awaitValue, ensureDefined, callWrap,
  contextOrFrameLookup, handleError, fromIterator, inOperator,
  createSafeString,
} from './index.js';

describe('suppressValue', () => {
  test('returns empty string for null/undefined', () => {
    expect(suppressValue(null)).toBe('');
    expect(suppressValue(undefined)).toBe('');
  });

  test('returns value as-is when autoescape is false', () => {
    expect(suppressValue('hello', false)).toBe('hello');
  });

  test('escapes when autoescape is true', () => {
    const result = suppressValue('<script>', true);
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
    const warnings = [];
    expect(ensureDefined.call({ __warnings__: warnings }, null, 1, 2, null, null, 'debug')).toBe('undefined');
    expect(ensureDefined.call({ __warnings__: warnings }, undefined, 1, 2, null, null, 'debug')).toBe('undefined');
    expect(warnings).toHaveLength(2);
  });

  test('collects debug warnings without duplicate console output', () => {
    const warnings = [];
    const originalWarn = console.warn;
    let calls = 0;
    console.warn = () => { calls += 1; };
    try {
      expect(ensureDefined.call({ __warnings__: warnings }, undefined, 1, 2, 'value', 'inline', 'debug')).toBe('undefined');
    } finally {
      console.warn = originalWarn;
    }
    expect(calls).toBe(0);
    expect(warnings).toHaveLength(1);
  });

  test('prints debug warnings when no collector exists', () => {
    const originalWarn = console.warn;
    let calls = 0;
    console.warn = () => { calls += 1; };
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
    try { ensureDefined(null, 1, 2, 'x', null, 'strict'); } catch (e) {
      expect(e.code).toBe('UNDEFINED_VARIABLE');
    }
  });

  test('sets code UNDEFINED_VALUE without varName in strict mode', () => {
    try { ensureDefined(undefined, 1, 2, null, null, 'strict'); } catch (e) {
      expect(e.code).toBe('UNDEFINED_VALUE');
    }
  });

  test('error has phase render in strict mode', () => {
    try { ensureDefined(null, 1, 2, null, null, 'strict'); } catch (e) {
      expect(e.phase).toBe('render');
    }
  });
});

describe('undefined mode integration', () => {
  test('Symbol in debug mode shows warning but returns undefined', async () => {
    const nunjucks = (await import('../index.js')).default;
    const result = await nunjucks('{{ user }}', { user: undefined }, { undefined: 'debug' });
    expect(result).toBe('undefined');
  });

  test('LookupVal (member access) in debug mode shows warning but returns undefined', async () => {
    const nunjucks = (await import('../index.js')).default;
    const result = await nunjucks('{{ user.name }}', { user: undefined }, { undefined: 'debug' });
    expect(result).toBe('undefined');
  });

  test('optional chaining in debug mode returns undefined without error', async () => {
    const nunjucks = (await import('../index.js')).default;
    const result = await nunjucks('{{ user?.name }}', { user: undefined }, { undefined: 'debug' });
    expect(result).toBe('undefined');
  });

  test('optional call with defined function calls function', async () => {
    const nunjucks = (await import('../index.js')).default;
    const result = await nunjucks('{{ foo?.() }}', { foo: () => 'Hello' }, { undefined: 'strict' });
    expect(result).toBe('Hello');
  });

  test('optional call with null returns empty', async () => {
    const nunjucks = (await import('../index.js')).default;
    const result = await nunjucks('{{ foo?.() }}', { foo: null });
    expect(result).toBe('');
  });

  test('optional call with arguments passes args', async () => {
    const nunjucks = (await import('../index.js')).default;
    const result = await nunjucks('{{ foo?.(x, y) }}', { foo: (a, b) => a + b, x: 3, y: 4 }, { undefined: 'strict' });
    expect(result).toBe('7');
  });

  test('method optional call with defined method', async () => {
    const nunjucks = (await import('../index.js')).default;
    const result = await nunjucks('{{ obj.method?.() }}', { obj: { method: () => 'result' } }, { undefined: 'strict' });
    expect(result).toBe('result');
  });

  test('method optional call with undefined method returns empty', async () => {
    const nunjucks = (await import('../index.js')).default;
    const result = await nunjucks('{{ obj.method?.() }}', { obj: {} });
    expect(result).toBe('');
  });
});

describe('callWrap', () => {
  test('calls function with context and args', () => {
    const fn = function(a, b) { return this.prefix + a + b; };
    const ctx = { prefix: 'r:' };
    expect(callWrap(fn, 'test', 'test()', ctx, ['x', 'y'])).toBe('r:xy');
  });

  test('throws NULL_VALUE for null/undefined obj', () => {
    expect(() => callWrap(null, 'foo', 'foo()', {}, [], 1, 2)).toThrow("Cannot access 'foo' on null");
    try { callWrap(null, 'foo', 'foo()', {}, [], 1, 2); } catch (e) {
      expect(e.code).toBe('NULL_VALUE');
    }
  });

  test('throws NOT_A_FUNCTION for non-function', () => {
    expect(() => callWrap(42, 'bar', 'bar()', {}, [], 1, 2)).toThrow('not a function');
    try { callWrap(42, 'bar', 'bar()', {}, [], 1, 2); } catch (e) {
      expect(e.code).toBe('NOT_A_FUNCTION');
    }
  });
});

describe('contextOrFrameLookup', () => {
  test('prefers frame lookup', () => {
    const frame = { lookup: () => 'from_frame' };
    const context = { lookup: () => 'from_context' };
    expect(contextOrFrameLookup(context, frame, 'x')).toBe('from_frame');
  });

  test('falls back to context lookup', () => {
    const frame = { lookup: () => undefined };
    const context = { lookup: () => 'from_context' };
    expect(contextOrFrameLookup(context, frame, 'x')).toBe('from_context');
  });
});

describe('handleError', () => {
  test('throws error unchanged if it has lineno', () => {
    const err = new Error('test');
    err.lineno = 5;
    expect(() => handleError(err, 1, 2)).toThrow(err);
  });

  test('throws error with lineno/colno', () => {
    const err = new Error('test');
    expect(() => handleError(err, 3, 7)).toThrow();
    try {
      handleError(err, 3, 7);
    } catch (e) {
      expect(e.lineno).toBe(3);
      expect(e.colno).toBe(7);
    }
  });

  test('preserves error code and subject', () => {
    const err = new Error('test');
    err.code = 'MY_CODE';
    err.subject = 'myVar';
    try {
      handleError(err, 1, 2);
    } catch (e) {
      expect(e.code).toBe('MY_CODE');
      expect(e.subject).toBe('myVar');
    }
  });

  test('normalizes primitive thrown values', () => {
    for (const value of ['boom', 42, null, undefined]) {
      try {
        handleError(value, 3, 7);
      } catch (error) {
        expect(error.lineno).toBe(3);
        expect(error.colno).toBe(7);
        expect(error.code).toBe('RUNTIME_ERROR');
      }
    }
  });

  test('handles frozen errors without mutating them', () => {
    const error = Object.freeze(new Error('frozen'));
    try {
      handleError(error, 2, 4);
    } catch (normalized) {
      expect(normalized.message).toBe('frozen');
      expect(normalized.lineno).toBe(2);
      expect(normalized.colno).toBe(4);
    }
  });
  test('keeps canonical template location even when sourceMapData is present', () => {
    const err = new Error('test');
    const sourceMapData = [{ compiledLine: 5, originalLine: 2, originalCol: 1 }];
    const runtime = { sourceMapData };
    try {
      handleError(err, 5, 0, runtime);
    } catch (e) {
      expect(e.lineno).toBe(5);
      expect(e.colno).toBe(0);
      expect(e.lineBase).toBe('zero');
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
      expect(e.code).toBe('IN_OPERATOR');
      expect(e.lineno).toBe(3);
      expect(e.colno).toBe(7);
      expect(e.lineBase).toBe('zero');
      return;
    }
    throw new Error('Expected inOperator to throw');
  });
});
