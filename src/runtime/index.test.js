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
    expect(() => ensureDefined(null, 1, 2, null, null, 'strict')).toThrow('null or undefined');
    expect(() => ensureDefined(undefined, 1, 2, null, null, 'strict')).toThrow('null or undefined');
  });

  test('returns undefined string in chainable mode (default)', () => {
    expect(ensureDefined(null, 1, 2)).toBe('undefined');
    expect(ensureDefined(undefined, 1, 2)).toBe('undefined');
  });

  test('returns undefined string in debug mode', () => {
    expect(ensureDefined(null, 1, 2, null, null, 'debug')).toBe('undefined');
    expect(ensureDefined(undefined, 1, 2, null, null, 'debug')).toBe('undefined');
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
    const { createEnvironment } = await import('../environment/index.js');
    const env = createEnvironment([], { undefined: 'debug' });

    const result = await env.renderString('{{ user }}', { user: undefined });
    expect(result).toBe('undefined');
  });

  test('LookupVal (member access) in debug mode throws error', async () => {
    const { createEnvironment } = await import('../environment/index.js');
    const env = createEnvironment([], { undefined: 'debug' });

    await expect(env.renderString('{{ user.name }}', { user: undefined }))
      .rejects.toThrow();
  });

  test('optional chaining in debug mode returns undefined without error', async () => {
    const { createEnvironment } = await import('../environment/index.js');
    const env = createEnvironment([], { undefined: 'debug' });

    const result = await env.renderString('{{ user?.name }}', { user: undefined });
    expect(result).toBe('undefined');
  });

  test('optional call with defined function calls function', async () => {
    const { createEnvironment } = await import('../environment/index.js');
    const env = createEnvironment([], { undefined: 'strict' });

    const result = await env.renderString('{{ foo?.() }}', { foo: () => 'Hello' });
    expect(result).toBe('Hello');
  });

  test('optional call with null returns empty', async () => {
    const { createEnvironment } = await import('../environment/index.js');
    const env = createEnvironment([]);

    const result = await env.renderString('{{ foo?.() }}', { foo: null });
    expect(result).toBe('');
  });

  test('optional call with arguments passes args', async () => {
    const { createEnvironment } = await import('../environment/index.js');
    const env = createEnvironment([], { undefined: 'strict' });

    const result = await env.renderString('{{ foo?.(x, y) }}', { foo: (a, b) => a + b, x: 3, y: 4 });
    expect(result).toBe('7');
  });

  test('method optional call with defined method', async () => {
    const { createEnvironment } = await import('../environment/index.js');
    const env = createEnvironment([], { undefined: 'strict' });

    const result = await env.renderString('{{ obj.method?.() }}', { obj: { method: () => 'result' } });
    expect(result).toBe('result');
  });

  test('method optional call with undefined method returns empty', async () => {
    const { createEnvironment } = await import('../environment/index.js');
    const env = createEnvironment([]);

    const result = await env.renderString('{{ obj.method?.() }}', { obj: {} });
    expect(result).toBe('');
  });
});

describe('callWrap', () => {
  test('calls function with context and args', () => {
    const fn = function(a, b) { return this.prefix + a + b; };
    const ctx = { prefix: 'r:' };
    expect(callWrap(fn, 'test', 'test()', ctx, ['x', 'y'])).toBe('r:xy');
  });

  test('throws UNDEFINED_FUNCTION for null/undefined obj', () => {
    expect(() => callWrap(null, 'foo', 'foo()', {}, [], 1, 2)).toThrow('Unable to call');
    try { callWrap(null, 'foo', 'foo()', {}, [], 1, 2); } catch (e) {
      expect(e.code).toBe('UNDEFINED_FUNCTION');
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
  test('returns error unchanged if it has lineno', () => {
    const err = new Error('test');
    err.lineno = 5;
    expect(handleError(err, 1, 2)).toBe(err);
  });

  test('wraps error in TemplateError with lineno/colno', () => {
    const err = new Error('test');
    const result = handleError(err, 3, 7);
    expect(result.lineno).toBe(3);
    expect(result.colno).toBe(7);
  });

  test('preserves error code and subject', () => {
    const err = new Error('test');
    err.code = 'MY_CODE';
    err.subject = 'myVar';
    const result = handleError(err, 1, 2);
    expect(result.code).toBe('MY_CODE');
    expect(result.subject).toBe('myVar');
  });

  test('handles sourceMapData', () => {
    const err = new Error('test');
    const sourceMapData = [{ compiledLine: 5, originalLine: 2, originalCol: 1 }];
    const result = handleError(err, 5, 0, sourceMapData);
    expect(result.lineno).toBe(2);
    expect(result.colno).toBe(1);
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
    expect(() => inOperator('x', 42)).toThrow('Cannot use "in" operator');
  });
});
