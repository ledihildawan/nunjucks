import { describe, expect, test } from 'bun:test';
import { escapeAttribute, escapeHtml, escapeScriptString, escapeStyle } from './escape.ts';

describe('escapeHtml', () => {
  test('escapes HTML metacharacters', () => {
    expect(escapeHtml('<a href="x">&')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;');
  });

  test('escapes quotes and backslashes', () => {
    expect(escapeHtml("'\\")).toBe('&#39;&#92;');
  });

  test('leaves plain text untouched', () => {
    expect(escapeHtml('plain text')).toBe('plain text');
  });
});

describe('escapeAttribute', () => {
  test('escapes double quotes, backticks and angle brackets', () => {
    expect(escapeAttribute('`<a "b">')).toBe('&#96;&lt;a &quot;b&quot;&gt;');
  });

  test('does not escape backslashes', () => {
    expect(escapeAttribute('a\\b')).toBe('a\\b');
  });
});

describe('escapeScriptString', () => {
  test('escapes quotes, newlines and angle brackets', () => {
    expect(escapeScriptString('</script>\n')).toBe('\\u003c/script\\u003e\\n');
  });

  test('backslash-escapes itself', () => {
    expect(escapeScriptString('a\\b')).toBe('a\\\\b');
  });
});

describe('escapeStyle', () => {
  test('escapes angle brackets and quotes', () => {
    expect(escapeStyle('a < b "c"')).toBe('a &lt; b &quot;c&quot;');
  });

  test('escapes itself first so attacker-crafted escapes cannot form', () => {
    expect(escapeStyle('\\3B')).toBe('\\5C 3B');
  });

  test('escapes statement and block-close delimiters with CSS hex escapes', () => {
    expect(escapeStyle('color: red; } body')).toBe('color: red\\3B  \\7D  body');
  });

  test('does not corrupt the semicolons inside emitted HTML entities', () => {
    expect(escapeStyle('a&b<c')).toBe('a&amp;b&lt;c');
  });
});
