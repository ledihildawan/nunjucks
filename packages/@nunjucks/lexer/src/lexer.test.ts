import { describe, test, expect } from 'bun:test';
import { createTokenizer } from './lexer.ts';

const tokens = (src: string) => {
  const tk = createTokenizer(src);
  const result = [];
  let t = tk.nextToken();
  while (t) { result.push(t); t = tk.nextToken(); }
  return result;
};

describe('createTokenizer', () => {
  test('tokenizes plain text as data token', () => {
    const tks = tokens('hello world');
    const dataTokens = tks.filter(t => t.type === 'data');
    expect(dataTokens.length).toBeGreaterThanOrEqual(1);
  });

  test('tokenizes {{ }} variable expression', () => {
    const tks = tokens('{{ x }}');
    expect(tks.some(t => t.type === 'variable-start')).toBe(true);
    expect(tks.some(t => t.type === 'variable-end')).toBe(true);
  });

  test('tokenizes {% %} block tag', () => {
    const tks = tokens('{% if true %}');
    expect(tks.some(t => t.type === 'block-start')).toBe(true);
    expect(tks.some(t => t.type === 'block-end')).toBe(true);
  });

  test('tokenizes {# #} comment', () => {
    const tks = tokens('{# comment #}');
    expect(tks.some(t => t.type === 'comment')).toBe(true);
  });

  test('tokenizes symbols inside code', () => {
    const tks = tokens('{{ x }}');
    const symbols = tks.filter(t => t.type === 'symbol');
    expect(symbols.some(s => s.value === 'x')).toBe(true);
  });

  test('tokenizes numbers', () => {
    const tks = tokens('{{ 42 }}');
    expect(tks.some(t => t.type === 'int' && t.value === 42)).toBe(true);
  });

  test('tokenizes string literals', () => {
    const tks = tokens('{{ "hello" }}');
    expect(tks.some(t => t.type === 'string')).toBe(true);
  });

  test('tokenizes operators', () => {
    const tks = tokens('{{ 1 + 2 }}');
    expect(tks.some(t => t.type === 'operator' && t.value === '+')).toBe(true);
  });

  test('returns null at end of stream', () => {
    const tk = createTokenizer('x');
    while (tk.nextToken()) { /* consume */ }
    expect(tk.nextToken()).toBeNull();
  });

  test('tags property returns delimiters', () => {
    const tk = createTokenizer('x');
    expect(tk.tags.BLOCK_START).toBe('{%');
    expect(tk.tags.BLOCK_END).toBe('%}');
    expect(tk.tags.VARIABLE_START).toBe('{{');
    expect(tk.tags.VARIABLE_END).toBe('}}');
  });

  test('trimBlocks and lstripBlocks are booleans', () => {
    const tk = createTokenizer('x');
    expect(typeof tk.trimBlocks).toBe('boolean');
    expect(typeof tk.lstripBlocks).toBe('boolean');
  });

  test('handles special characters without crash', () => {
    expect(() => tokens('{{ x.y.z }}')).not.toThrow();
  });
});
