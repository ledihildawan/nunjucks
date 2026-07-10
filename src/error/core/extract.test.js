import { describe, test, expect } from 'bun:test';
import {
  extractUndefinedName,
  extractLineInfo,
  extractColFromMessage,
  extractIncludeChainFromMessage,
  extractErrorTemplateName,
} from './extract.js';

describe('extractUndefinedName', () => {
  test('extracts name from call match', () => {
    expect(extractUndefinedName('Unable to call `foo`')).toBe('foo');
  });

  test('extracts name from output match', () => {
    expect(extractUndefinedName("attempted to output 'bar' null or undefined")).toBe('bar');
  });

  test('returns null for null/undefined output names', () => {
    expect(extractUndefinedName("attempted to output 'null' null or undefined")).toBeNull();
    expect(extractUndefinedName("attempted to output 'undefined' null or undefined")).toBeNull();
  });

  test('returns null for empty', () => {
    expect(extractUndefinedName(null)).toBeNull();
    expect(extractUndefinedName('')).toBeNull();
  });
});

describe('extractLineInfo', () => {
  test('extracts line and column from [Line N, Column M]', () => {
    expect(extractLineInfo('[Line 5, Column 10]')).toEqual({ line: 5, col: 10 });
  });

  test('extracts line only from [Line N]', () => {
    expect(extractLineInfo('[Line 3]')).toEqual({ line: 3, col: null });
  });

  test('extracts line from included from', () => {
    expect(extractLineInfo('(included from base.njk:10)')).toEqual({ line: 10, col: null });
  });

  test('returns null for no match', () => {
    expect(extractLineInfo('no info')).toEqual({ line: null, col: null });
  });

  test('returns null for empty', () => {
    expect(extractLineInfo(null)).toEqual({ line: null, col: null });
  });
});

describe('extractColFromMessage', () => {
  test('extracts column number', () => {
    expect(extractColFromMessage('at column 15')).toBe(15);
  });

  test('returns null for no match', () => {
    expect(extractColFromMessage('no column')).toBeNull();
  });

  test('returns null for empty', () => {
    expect(extractColFromMessage(null)).toBeNull();
  });
});

describe('extractIncludeChainFromMessage', () => {
  test('extracts chain from message', () => {
    const result = extractIncludeChainFromMessage('(included from parent.html:5:3)');
    expect(result).toEqual([{ parentTmpl: 'parent.html', parentLineno: 5, parentColno: 3 }]);
  });

  test('returns null for no match', () => {
    expect(extractIncludeChainFromMessage('no match')).toBeNull();
  });
});

describe('extractErrorTemplateName', () => {
  test('extracts template name from included from', () => {
    expect(extractErrorTemplateName('(included from child.html:1)')).toBe('child.html');
  });

  test('extracts template name from parens', () => {
    expect(extractErrorTemplateName('(page.html)')).toBe('page.html');
  });

  test('returns null for no match', () => {
    expect(extractErrorTemplateName('no match')).toBeNull();
  });

  test('returns null for empty', () => {
    expect(extractErrorTemplateName(null)).toBeNull();
  });
});
