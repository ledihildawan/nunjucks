import { describe, test, expect } from 'bun:test';
import { escapeHtml, renderInlineMarkdown, highlightHtml, highlightJs } from './highlight.js';

describe('escapeHtml', () => {
  test('escapes & < > and "', () => {
    expect(escapeHtml('&<>"')).toBe('&amp;&lt;&gt;&quot;');
  });

  test('returns empty string for falsy input', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  test('passes through text without special chars', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('renderInlineMarkdown', () => {
  test('renders inline code with backticks', () => {
    expect(renderInlineMarkdown('use `foo()`')).toBe('use <code class="md-code">foo()</code>');
  });

  test('renders bold with **', () => {
    expect(renderInlineMarkdown('**warning**')).toBe('<strong>warning</strong>');
  });

  test('escapes HTML in text', () => {
    expect(renderInlineMarkdown('<script>')).toBe('&lt;script&gt;');
  });

  test('returns empty for falsy input', () => {
    expect(renderInlineMarkdown('')).toBe('');
    expect(renderInlineMarkdown(null)).toBe('');
  });
});

describe('highlightHtml', () => {
  test('highlights nunjucks delimiters', () => {
    const result = highlightHtml('{{ x }}');
    expect(result).toContain('syntax-delimiter');
    expect(result).toContain('syntax-variable');
  });

  test('highlights strings', () => {
    const result = highlightHtml('{{ "hello" }}');
    expect(result).toContain('syntax-string');
  });

  test('highlights numbers', () => {
    const result = highlightHtml('{{ 42 }}');
    expect(result).toContain('syntax-number');
  });

  test('highlights keywords', () => {
    const result = highlightHtml('{% if x %}');
    expect(result).toContain('syntax-keyword');
    expect(result).toContain('syntax-delimiter');
  });

  test('returns empty for falsy input', () => {
    expect(highlightHtml('')).toBe('');
    expect(highlightHtml(null)).toBe('');
  });
});

describe('highlightJs', () => {
  test('highlights strings', () => {
    const result = highlightJs('"hello"');
    expect(result).toContain('syntax-string');
  });

  test('highlights numbers', () => {
    const result = highlightJs('42');
    expect(result).toContain('syntax-number');
  });

  test('highlights keywords', () => {
    const result = highlightJs('function foo()');
    expect(result).toContain('syntax-keyword');
  });

  test('highlights comments', () => {
    const result = highlightJs('// comment');
    expect(result).toContain('syntax-comment');
  });

  test('returns empty for falsy input', () => {
    expect(highlightJs('')).toBe('');
    expect(highlightJs(null)).toBe('');
  });
});
