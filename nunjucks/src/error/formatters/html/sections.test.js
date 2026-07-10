import { describe, test, expect } from 'bun:test';
import { formatCodeTraceHtml, renderContextHtml, formatStackTraceHtml } from './sections.js';

describe('formatCodeTraceHtml', () => {
  test('renders snippet lines', () => {
    const result = formatCodeTraceHtml('  1: hello\n  2: world');
    expect(result).toContain('code-line');
    expect(result).toContain('hello');
    expect(result).toContain('world');
  });

  test('highlights error line with >>> prefix', () => {
    const result = formatCodeTraceHtml('  1: foo\n>>> 2: bar\n  3: baz');
    expect(result).toContain('is-error');
    expect(result).toContain('bar');
  });

  test('returns placeholder for falsy snippet', () => {
    const result = formatCodeTraceHtml(null);
    expect(result).toContain('Source not available');
  });

  test('returns placeholder for empty snippet', () => {
    const result = formatCodeTraceHtml('');
    expect(result).toContain('Source not available');
  });
});

describe('renderContextHtml', () => {
  test('renders context with data script', () => {
    const result = renderContextHtml({ foo: 'bar' });
    expect(result).toContain('ctx-tree');
    expect(result).toContain('__ctxData');
    expect(result).toContain('"foo"');
    expect(result).toContain('"bar"');
  });

  test('returns empty for falsy context', () => {
    expect(renderContextHtml(null)).toBe('');
    expect(renderContextHtml(undefined)).toBe('');
  });

  test('returns empty for non-object', () => {
    expect(renderContextHtml('string')).toBe('');
  });

  test('returns empty for empty object', () => {
    expect(renderContextHtml({})).toBe('');
  });

  test('filters __nunjucks keys', () => {
    const result = renderContextHtml({ foo: 'bar', __nunjucks_internal: true });
    expect(result).toContain('"foo"');
    expect(result).not.toContain('__nunjucks_internal');
  });

  test('filters blocked keys', () => {
    const result = renderContextHtml({
      name: 'Alice',
      __proto__: { dangerous: true },
      constructor: { dangerous: true },
      toString: () => 'test'
    });
    expect(result).toContain('"name"');
    expect(result).not.toContain('__proto__');
    expect(result).not.toContain('constructor');
    expect(result).not.toContain('toString');
  });

  test('filters blocked keys in nested objects', () => {
    const result = renderContextHtml({
      user: {
        name: 'Alice',
        __proto__: { evil: true },
        constructor: { evil: true }
      }
    });
    expect(result).toContain('"name"');
    expect(result).not.toContain('__proto__');
    expect(result).not.toContain('constructor');
  });
});

describe('formatStackTraceHtml', () => {
  test('renders stack trace lines', () => {
    const err = {
      stack: 'Error: test\n    at foo.js:1:2\n    at bar.js:3:4',
    };
    const result = formatStackTraceHtml(err);
    expect(result).toContain('stack-trace');
    expect(result).toContain('foo.js');
    expect(result).toContain('bar.js');
  });

  test('returns empty for missing stack', () => {
    expect(formatStackTraceHtml(null)).toBe('');
    expect(formatStackTraceHtml({})).toBe('');
  });

  test('filters nunjucks src lines in production', () => {
    const err = {
      stack: 'Error: test\n    at C:\\nunjucks\\nunjucks\\src\\file.js:1:2\n    at myapp.js:3:4',
    };
    const result = formatStackTraceHtml(err, true);
    expect(result).not.toContain('nunjucks');
    expect(result).toContain('myapp.js');
  });

  test('shows all lines in dev mode', () => {
    const err = {
      stack: 'Error: test\n    at nunjucks/src/file.js:1:2\n    at myapp.js:3:4',
    };
    const result = formatStackTraceHtml(err, false);
    expect(result).toContain('nunjucks');
    expect(result).toContain('myapp.js');
  });

  test('collapses after 5 lines', () => {
    const lines = Array.from({ length: 8 }, (_, i) => `    at file${i}.js:${i + 1}:2`);
    const err = { stack: `Error: test\n${lines.join('\n')}` };
    const result = formatStackTraceHtml(err);
    expect(result).toContain('Show 3 more lines');
  });

  test('returns empty when no "at " lines', () => {
    const err = { stack: 'Error: test\n  some random line' };
    expect(formatStackTraceHtml(err)).toBe('');
  });
});
