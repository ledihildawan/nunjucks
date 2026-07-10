import { describe, test, expect } from 'bun:test';
import { formatStackTrace } from './stack-trace.js';

describe('formatStackTrace', () => {
  test('returns empty string for error without stack', () => {
    expect(formatStackTrace({})).toBe('');
    expect(formatStackTrace(null)).toBe('');
    expect(formatStackTrace(undefined)).toBe('');
  });

  test('returns empty string for empty stack', () => {
    const err = new Error('test');
    err.stack = 'Error: test';
    expect(formatStackTrace(err)).toBe('');
  });

  test('formats stack trace lines with hyperlinks', () => {
    const err = new Error('test');
    err.stack = [
      'Error: test',
      'at myFunc (C:\\project\\src\\app.js:10:5)',
      'at otherFunc (C:\\project\\src\\lib.js:20:3)',
    ].join('\n');
    const result = formatStackTrace(err, false, 'vscode');
    expect(result).toContain('Stack Trace:');
    expect(result).toContain('app.js');
    expect(result).toContain('lib.js');
  });

  test('filters nunjucks src lines in production mode', () => {
    const err = new Error('test');
    err.stack = [
      'Error: test',
      'at userCode (C:\\myapp\\index.js:1:1)',
      'at nunjucks (C:\\project\\nunjucks\\nunjucks\\src\\something.js:10:5)',
    ].join('\n');
    const result = formatStackTrace(err, true, 'vscode');
    expect(result).toContain('index.js');
    expect(result).not.toContain('nunjucks');
  });

  test('returns empty when all lines filtered in production', () => {
    const err = new Error('test');
    err.stack = [
      'Error: test',
      'at nunjucks (C:\\project\\nunjucks\\nunjucks\\src\\something.js:10:5)',
    ].join('\n');
    const result = formatStackTrace(err, true, 'vscode');
    expect(result).toBe('');
  });

  test('handles native and anonymous stack lines', () => {
    const err = new Error('test');
    err.stack = [
      'Error: test',
      'at foo (native)',
      'at bar (<anonymous>:1:1)',
    ].join('\n');
    const result = formatStackTrace(err, false, 'vscode');
    expect(result).toContain('native');
    expect(result).toContain('anonymous');
  });
});
