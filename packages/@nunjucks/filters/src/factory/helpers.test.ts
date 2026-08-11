import { describe, test, expect } from 'bun:test';
import type { ErrorDefinitionEntry } from '@nunjucks/error-formatter';
import {
  makeFilterError,
  normalize,
  safeString,
  safeHtml,
  preserveSafe,
  requireArrayError,
  requireNumberError,
  validateItemsHaveAttr,
  isSafeString,
} from './helpers.ts';

const filterErrorDef: ErrorDefinitionEntry = {
  name: 'CUSTOM_FILTER_ERROR',
  message: 'custom filter failure',
  pattern: /filter/,
};

describe('normalize', () => {
  const fallback = 'fallback';

  type NormalizeCase = { readonly label: string; readonly input: unknown; readonly expected: string };
  const normalizeCases: readonly NormalizeCase[] = [
    { label: 'a truthy string', input: 'hello', expected: 'hello' },
    { label: 'a number coerced to string', input: 42, expected: '42' },
    { label: 'true coerced to "true"', input: true, expected: 'true' },
    { label: 'zero (falsy but defined) preserved', input: 0, expected: '0' },
    { label: 'an empty string preserved', input: '', expected: '' },
    { label: 'null replaced by default', input: null, expected: fallback },
    { label: 'undefined replaced by default', input: undefined, expected: fallback },
    { label: 'false replaced by default', input: false, expected: fallback },
    { label: 'a plain object stringified', input: { key: 'value' }, expected: '[object Object]' },
    { label: 'an array joined by commas', input: [1, 2, 3], expected: '1,2,3' },
    { label: 'NaN stringified', input: Number.NaN, expected: 'NaN' },
  ];

  normalizeCases.forEach(({ label, input, expected }) => {
    test(`normalizes ${label} to "${expected}"`, () => {
      expect(normalize(input, fallback)).toBe(expected);
    });
  });
});

describe('safeString', () => {
  test('wraps a plain string as a SafeString', () => {
    const result = safeString('hello');
    expect(isSafeString(result)).toBe(true);
    expect(result.toString()).toBe('hello');
    expect(result.valueOf()).toBe('hello');
  });

  test('wraps an empty string', () => {
    const result = safeString('');
    expect(isSafeString(result)).toBe(true);
    expect(result.toString()).toBe('');
  });

  test('returns an empty SafeString for nullish input', () => {
    expect(isSafeString(safeString(null))).toBe(true);
    expect(safeString(null).toString()).toBe('');
    expect(safeString(undefined).toString()).toBe('');
  });

  test('coerces non-string input to its string form', () => {
    expect(safeString(42).toString()).toBe('42');
    expect(safeString(0).toString()).toBe('0');
  });

  test('returns the same reference when given an existing SafeString', () => {
    const existing = safeString('inner');
    expect(safeString(existing)).toBe(existing);
  });
});

describe('safeHtml', () => {
  test('wraps a plain string as a SafeString', () => {
    const result = safeHtml('hello');
    expect(isSafeString(result)).toBe(true);
    expect(result.toString()).toBe('hello');
  });

  type EscapeCase = { readonly label: string; readonly input: string; readonly expected: string };
  const escapeCases: readonly EscapeCase[] = [
    { label: 'angle brackets', input: '<b>x</b>', expected: '&lt;b&gt;x&lt;/b&gt;' },
    { label: 'ampersand', input: 'a & b', expected: 'a &amp; b' },
    { label: 'double quotes', input: '"quoted"', expected: '&quot;quoted&quot;' },
    { label: 'single quotes', input: "it's", expected: 'it&#39;s' },
    { label: 'backslash', input: 'back\\slash', expected: 'back&#92;slash' },
    { label: 'unchanged plain text', input: 'plain text', expected: 'plain text' },
  ];

  escapeCases.forEach(({ label, input, expected }) => {
    test(`escapes ${label} to "${expected}"`, () => {
      expect(safeHtml(input).toString()).toBe(expected);
    });
  });

  test('returns an empty SafeString for nullish input', () => {
    expect(isSafeString(safeHtml(null))).toBe(true);
    expect(safeHtml(null).toString()).toBe('');
    expect(safeHtml(undefined).toString()).toBe('');
  });

  test('returns the same reference for an existing SafeString without double-escaping', () => {
    const existing = safeHtml('<b>already safe</b>');
    const passedThrough = safeHtml(existing);
    expect(passedThrough).toBe(existing);
    expect(passedThrough.toString()).toBe('&lt;b&gt;already safe&lt;/b&gt;');
  });
});

describe('preserveSafe', () => {
  test('returns a plain string when the original is not safe', () => {
    const result = preserveSafe('plain-original', 'wrapped');
    expect(result).toBe('wrapped');
    expect(isSafeString(result)).toBe(false);
  });

  test('wraps the result as a SafeString when the original is safe', () => {
    const safeOriginal = safeString('safe-original');
    const result = preserveSafe(safeOriginal, 'wrapped');
    expect(isSafeString(result)).toBe(true);
    expect(result.toString()).toBe('wrapped');
  });

  test('does not mark the result safe when the original is nullish', () => {
    expect(preserveSafe(null, 'wrapped')).toBe('wrapped');
    expect(isSafeString(preserveSafe(null, 'wrapped'))).toBe(false);
  });
});

describe('validateItemsHaveAttr', () => {
  test('returns ok with the items when every item has the attribute', () => {
    const items = [{ id: 1 }, { id: 2 }];
    const result = validateItemsHaveAttr({ items, attr: 'id', errorDef: undefined });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(items);
    }
  });

  test('returns ok for an empty items array (vacuous truth)', () => {
    const result = validateItemsHaveAttr({ items: [], attr: 'id', errorDef: undefined });
    expect(result.ok).toBe(true);
  });

  test('returns err when an item is missing the attribute', () => {
    const items = [{ id: 1 }, { name: 'x' }];
    const result = validateItemsHaveAttr({ items, attr: 'id', errorDef: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.name).toBe('Template render error');
    }
  });

  test('returns err when an item is null', () => {
    const result = validateItemsHaveAttr({ items: [null], attr: 'id', errorDef: undefined });
    expect(result.ok).toBe(false);
  });

  test('returns err when an item is a primitive', () => {
    const result = validateItemsHaveAttr({ items: ['scalar'], attr: 'id', errorDef: undefined });
    expect(result.ok).toBe(false);
  });

  test('uses the provided errorDef to build the error', () => {
    const items = [{ name: 'x' }];
    const result = validateItemsHaveAttr({ items, attr: 'id', errorDef: filterErrorDef });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CUSTOM_FILTER_ERROR');
      expect(result.error.message).toBe('custom filter failure');
    }
  });
});

describe('makeFilterError', () => {
  test('builds an error from a provided errorDef', () => {
    const result = makeFilterError({
      errorDef: filterErrorDef,
      params: { attr: 'name' },
      subject: 'name',
      fallbackMessage: 'should not be used',
    });
    expect(result.name).toBe('Template render error');
    expect(result.code).toBe('CUSTOM_FILTER_ERROR');
    expect(result.message).toBe('custom filter failure');
    expect(result.subject).toBe('name');
  });

  test('falls back to a FILTER_ERROR with the fallbackMessage when errorDef is undefined', () => {
    const result = makeFilterError({
      errorDef: undefined,
      params: {},
      subject: 'subject',
      fallbackMessage: 'something went wrong',
    });
    expect(result.code).toBe('FILTER_ERROR');
    expect(result.message).toBe('something went wrong');
    expect(result.subject).toBe('subject');
  });

  test('applies the default inline log context produced by the internal getLogContext', () => {
    const result = makeFilterError({
      errorDef: undefined,
      params: {},
      subject: 'subject',
      fallbackMessage: 'fail',
    });
    expect(result.templateName).toBe('inline');
    expect(result.phase).toBe('render');
  });

  test('renders a function message in the errorDef using the supplied params', () => {
    const fnDef: ErrorDefinitionEntry = {
      name: 'PARAM_ERR',
      message: (args) => `attr ${(args as Record<string, string> | undefined)?.attr ?? '?'}`,
      pattern: /./,
    };
    const result = makeFilterError({
      errorDef: fnDef,
      params: { attr: 'name' },
      subject: 'name',
      fallbackMessage: 'unused',
    });
    expect(result.message).toBe('attr name');
  });
});

describe('requireArrayError', () => {
  type RequireErrorCase = { readonly label: string; readonly input: unknown; readonly expectedType: string };
  const requireArrayCases: readonly RequireErrorCase[] = [
    { label: 'a string', input: 'not-array', expectedType: 'string' },
    { label: 'a number', input: 42, expectedType: 'number' },
    { label: 'a boolean', input: true, expectedType: 'boolean' },
    { label: 'null (typeof object)', input: null, expectedType: 'object' },
    { label: 'undefined', input: undefined, expectedType: 'undefined' },
  ];

  requireArrayCases.forEach(({ label, input, expectedType }) => {
    test(`builds an "Expected array but got ${expectedType}" error for ${label}`, () => {
      const result = requireArrayError(input, undefined);
      expect(result.message).toBe(`Expected array but got ${expectedType}`);
      expect(result.subject).toBe(expectedType);
      expect(result.code).toBe('FILTER_ERROR');
    });
  });

  test('uses the provided errorDef instead of the fallback message', () => {
    const result = requireArrayError('not-array', filterErrorDef);
    expect(result.code).toBe('CUSTOM_FILTER_ERROR');
    expect(result.message).toBe('custom filter failure');
    expect(result.subject).toBe('string');
  });
});

describe('requireNumberError', () => {
  type RequireErrorCase = { readonly label: string; readonly input: unknown; readonly expectedType: string };
  const requireNumberCases: readonly RequireErrorCase[] = [
    { label: 'a string', input: 'not-number', expectedType: 'string' },
    { label: 'a boolean', input: true, expectedType: 'boolean' },
    { label: 'null (typeof object)', input: null, expectedType: 'object' },
    { label: 'undefined', input: undefined, expectedType: 'undefined' },
  ];

  requireNumberCases.forEach(({ label, input, expectedType }) => {
    test(`builds an "Expected number but got ${expectedType}" error for ${label}`, () => {
      const result = requireNumberError(input, undefined);
      expect(result.message).toBe(`Expected number but got ${expectedType}`);
      expect(result.subject).toBe(expectedType);
      expect(result.code).toBe('FILTER_ERROR');
    });
  });

  test('uses the provided errorDef instead of the fallback message', () => {
    const result = requireNumberError('not-number', filterErrorDef);
    expect(result.code).toBe('CUSTOM_FILTER_ERROR');
    expect(result.message).toBe('custom filter failure');
    expect(result.subject).toBe('string');
  });
});

describe('isSafeString (re-exported)', () => {
  test('identifies a SafeString produced by safeString', () => {
    expect(isSafeString(safeString('x'))).toBe(true);
  });

  test('returns false for plain strings and nullish values', () => {
    expect(isSafeString('plain')).toBe(false);
    expect(isSafeString(null)).toBe(false);
    expect(isSafeString(undefined)).toBe(false);
  });
});
