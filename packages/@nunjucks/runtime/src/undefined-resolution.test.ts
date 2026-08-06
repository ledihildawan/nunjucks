import { describe, test, expect } from 'bun:test';
import { ensureDefined } from './index.ts';

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
