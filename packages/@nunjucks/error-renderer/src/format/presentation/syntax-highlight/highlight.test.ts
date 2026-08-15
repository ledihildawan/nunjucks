import { describe, expect, test } from 'bun:test';
import { highlightHtml, highlightJs, renderInlineMarkdown } from './highlight.ts';

describe('renderInlineMarkdown', () => {
  test('empty returns empty', () => {
    expect(renderInlineMarkdown('')).toBe('');
  });

  test('backtick to code', () => {
    expect(renderInlineMarkdown('use `foo`')).toContain('md-code');
  });

  test('bold', () => {
    const r = renderInlineMarkdown('**bold**');
    expect(r).toContain('<strong>');
  });

  test('escapes HTML metacharacters', () => {
    expect(renderInlineMarkdown('<script>')).toContain('&lt;');
  });
});

describe('highlightHtml', () => {
  test('empty returns empty', () => {
    expect(highlightHtml('')).toBe('');
  });

  test('tag delimiters toggle inTag', () => {
    const r = highlightHtml('{{ x }}');
    expect(r).toContain('syntax-');
    expect(r.length).toBeGreaterThan(0);
  });

  test('comment highlighted', () => {
    const r = highlightHtml('{# c #}');
    expect(r).toContain('syntax-comment');
  });
});

describe('highlightJs', () => {
  test('empty returns empty', () => {
    expect(highlightJs('')).toBe('');
  });

  test('keywords highlighted', () => {
    const r = highlightJs('const x = 1');
    expect(r).toContain('syntax-');
  });

  test('line comment', () => {
    const r = highlightJs('// comment');
    expect(r).toContain('syntax-comment');
  });
});
