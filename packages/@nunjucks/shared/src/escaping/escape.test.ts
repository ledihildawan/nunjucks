import { expect, describe, test } from 'bun:test';
import { escapeHtml } from './escape';

describe('escapeHtml', () => {
  test('escapes & → &amp;', () => {
    expect(escapeHtml('&')).toBe('&amp;');
  });

  test('escapes < → &lt;', () => {
    expect(escapeHtml('<')).toBe('&lt;');
  });

  test('escapes > → &gt;', () => {
    expect(escapeHtml('>')).toBe('&gt;');
  });

  test('escapes " → &quot;', () => {
    expect(escapeHtml('"')).toBe('&quot;');
  });

  test("escapes ' → &#39;", () => {
    expect(escapeHtml("'")).toBe('&#39;');
  });

  test('escapes \\ → &#92;', () => {
    expect(escapeHtml('\\')).toBe('&#92;');
  });

  test('chained escapes for XSS payload', () => {
    expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
    );
  });

  test('identity on plain text with no special chars', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  test('empty string returns empty', () => {
    expect(escapeHtml('')).toBe('');
  });

  test('unicode passes through unchanged', () => {
    expect(escapeHtml('日本語')).toBe('日本語');
    expect(escapeHtml('😀')).toBe('😀');
    expect(escapeHtml('🎉')).toBe('🎉');
  });

  test('all replacements applied in order', () => {
    expect(escapeHtml('&<>')).toBe('&amp;&lt;&gt;');
  });
});
