import { describe, expect, test } from 'bun:test';
import { formatStackTraceHtml, renderContextHtml } from './sections.ts';

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
    expect(formatStackTraceHtml({ originalError: null })).toBe('');
    expect(formatStackTraceHtml({ originalError: {} })).toBe('');
  });

  test('renders stack rows from a JS stack string', () => {
    const html = formatStackTraceHtml({
      originalError: {
        stack: 'Error: boom\n    at foo (bar.js:1:5)\n    at baz (qux.js:2:10)',
      },
    });
    expect(html).toContain('stack-trace');
    expect(html).toContain('foo');
    expect(html).toContain('bar.js');
  });
});
