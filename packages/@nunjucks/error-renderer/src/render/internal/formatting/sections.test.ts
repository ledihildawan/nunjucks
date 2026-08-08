import { describe, test, expect } from 'bun:test';
import { formatCodeTraceHtml, formatJsTraceHtml, renderContextHtml, formatStackTraceHtml } from './sections.ts';

describe('formatCodeTraceHtml', () => {
  test('renders a placeholder when the snippet is empty', () => {
    expect(formatCodeTraceHtml('')).toContain('Source not available');
  });

  test('marks an error line (>>>) with is-error', () => {
    const html = formatCodeTraceHtml('>>>1: {{ x }}');
    expect(html).toContain('is-error');
    expect(html).toContain('code-line');
  });
});

describe('formatJsTraceHtml', () => {
  test('returns empty string for no lines', () => {
    expect(formatJsTraceHtml([])).toBe('');
  });

  test('renders a highlighted row per caller line', () => {
    const html = formatJsTraceHtml([{ lineNum: '5', code: 'foo()', isError: false }]);
    expect(html).toContain('code-line');
    expect(html).toContain('syntax-variable');
    expect(html).toContain('foo');
  });
});

describe('renderContextHtml', () => {
  test('returns empty for non-object input', () => {
    expect(renderContextHtml(null)).toBe('');
    expect(renderContextHtml('hi')).toBe('');
  });

  test('emits a render-context section with serialized data', () => {
    const html = renderContextHtml({ a: 1 });
    expect(html).toContain('render-context');
    expect(html).toContain('ctx-data');
    expect(html).toContain('"a":1');
  });
});

describe('formatStackTraceHtml', () => {
  test('returns empty when there is no stack', () => {
    expect(formatStackTraceHtml(null)).toBe('');
    expect(formatStackTraceHtml({})).toBe('');
  });

  test('renders stack rows from a JS stack string', () => {
    const html = formatStackTraceHtml({
      stack: 'Error: boom\n    at foo (bar.js:1:5)\n    at baz (qux.js:2:10)',
    });
    expect(html).toContain('stack-trace');
    expect(html).toContain('foo');
    expect(html).toContain('bar.js');
  });
});
