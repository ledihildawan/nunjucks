import { describe, test, expect } from 'bun:test';
import { formatLocation, getDisplayMessage, formatCodeTrace } from './message-formatter.js';

describe('formatLocation', () => {
  test('formats location with line and col', () => {
    const data = { templateName: 'page.njk', line: 5, col: 10, includeChain: null };
    expect(formatLocation(data)).toBe('page.njk:5:10');
  });

  test('formats location with line only', () => {
    const data = { templateName: 'page.njk', line: 5, col: null, includeChain: null };
    expect(formatLocation(data)).toBe('page.njk:5');
  });

  test('includes parent chain', () => {
    const data = {
      templateName: 'child.njk', line: 3, col: 1,
      includeChain: [{ parentTmpl: 'base.njk', parentLineno: 10, parentColno: 5 }],
    };
    expect(formatLocation(data)).toContain('included from base.njk:10:5');
  });
});

describe('getDisplayMessage', () => {
  test('shows variable name for undefined_variable', () => {
    const data = {
      message: "attempted to output 'x' null or undefined",
      subject: 'x',
      classified: { category: 'undefined_variable', undefinedName: 'x' },
    };
    expect(getDisplayMessage(data)).toBe("Variable 'x' is undefined or null");
  });

  test('shows generic message for undefined_variable without name', () => {
    const data = {
      message: 'attempted to output null or undefined value',
      subject: null,
      classified: { category: 'undefined_variable', undefinedName: null },
    };
    expect(getDisplayMessage(data)).toBe('Variable is undefined or null');
  });

  test('shows function name for undefined_function', () => {
    const data = {
      message: 'Unable to call `foo`, which is undefined or falsey',
      subject: 'foo',
      classified: { category: 'undefined_function', undefinedName: 'foo' },
    };
    expect(getDisplayMessage(data)).toBe("Unable to call 'foo', which is undefined or falsey");
  });

  test('shows name for not_a_function', () => {
    const data = {
      message: 'Unable to call `bar`, which is not a function',
      subject: 'bar',
      classified: { category: 'not_a_function', undefinedName: 'bar' },
    };
    expect(getDisplayMessage(data)).toBe("'bar' is not a function");
  });

  test('formats circular include', () => {
    const data = {
      message: 'Circular include detected: "foo.njk"',
      subject: 'foo.njk',
      classified: { category: 'circular_include', undefinedName: 'foo.njk' },
    };
    expect(getDisplayMessage(data)).toBe('Circular include detected: "foo.njk"');
  });

  test('falls back to error text for unknown category', () => {
    const data = {
      message: 'something went wrong',
      subject: null,
      classified: { category: 'unknown', undefinedName: null },
    };
    expect(getDisplayMessage(data)).toBe('something went wrong');
  });
});

describe('formatCodeTrace', () => {
  test('splits snippet into trimmed lines', () => {
    const result = formatCodeTrace('  line1\n  line2');
    expect(result).toEqual(['line1', 'line2']);
  });

  test('returns empty array for empty', () => {
    expect(formatCodeTrace(null)).toEqual([]);
  });
});
