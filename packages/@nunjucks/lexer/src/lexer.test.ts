import { describe, expect, test } from 'bun:test';
import { createTokenizer } from './lexer.ts';

const tokens = (src: string) => {
  const tk = createTokenizer(src);
  const result = [];
  let t = tk.nextToken();
  while (t) {
    result.push(t);
    t = tk.nextToken();
  }
  return result;
};

describe('createTokenizer', () => {
  test('tokenizes plain text as data token', () => {
    const tks = tokens('hello world');
    const dataTokens = tks.filter((t) => t.type === 'data');
    expect(dataTokens.length).toBeGreaterThanOrEqual(1);
  });

  test('tokenizes {{ }} variable expression', () => {
    const tks = tokens('{{ x }}');
    expect(tks.some((t) => t.type === 'variable-start')).toBe(true);
    expect(tks.some((t) => t.type === 'variable-end')).toBe(true);
  });

  test('tokenizes {% %} block tag', () => {
    const tks = tokens('{% if true %}');
    expect(tks.some((t) => t.type === 'block-start')).toBe(true);
    expect(tks.some((t) => t.type === 'block-end')).toBe(true);
  });

  test('tokenizes {# #} comment', () => {
    const tks = tokens('{# comment #}');
    expect(tks.some((t) => t.type === 'comment')).toBe(true);
  });

  test('tokenizes symbols inside code', () => {
    const tks = tokens('{{ x }}');
    const symbols = tks.filter((t) => t.type === 'symbol');
    expect(symbols.some((s) => s.value === 'x')).toBe(true);
  });

  test('tokenizes numbers', () => {
    const tks = tokens('{{ 42 }}');
    expect(tks.some((t) => t.type === 'int' && t.value === 42)).toBe(true);
  });

  test('tokenizes string literals', () => {
    const tks = tokens('{{ "hello" }}');
    expect(tks.some((t) => t.type === 'string')).toBe(true);
  });

  test('tokenizes operators', () => {
    const tks = tokens('{{ 1 + 2 }}');
    expect(tks.some((t) => t.type === 'operator' && t.value === '+')).toBe(true);
  });

  test('returns null at end of stream', () => {
    const tk = createTokenizer('x');
    while (tk.nextToken()) {}
    expect(tk.nextToken()).toBeNull();
  });

  test('tags property returns delimiters', () => {
    const tk = createTokenizer('x');
    expect(tk.tags.blockStart).toBe('{%');
    expect(tk.tags.blockEnd).toBe('%}');
    expect(tk.tags.variableStart).toBe('{{');
    expect(tk.tags.variableEnd).toBe('}}');
  });

  test('returns tokenizer result with nextToken and tags', () => {
    const tk = createTokenizer('x');
    expect(typeof tk.nextToken).toBe('function');
    expect(typeof tk.tags).toBe('object');
    expect(tk.tags.blockStart).toBe('{%');
    expect(tk.tags.blockEnd).toBe('%}');
  });

  test('handles special characters without crash', () => {
    expect(() => tokens('{{ x.y.z }}')).not.toThrow();
    const tks = tokens('{{ x.y.z }}');
    expect(tks.filter((t) => t.type === 'symbol').map((t) => t.value)).toEqual(['x', 'y', 'z']);
    expect(tks.some((t) => t.type === 'operator' && t.value === '.')).toBe(true);
  });

  test('tokenizes unicode strings and indexed access', () => {
    const unicodeTks = tokens('{{ "café 日本語" }}');
    expect(unicodeTks.some((t) => t.type === 'string' && t.value === 'café 日本語')).toBe(true);

    const indexTks = tokens('{{ arr[0] }}');
    expect(indexTks.some((t) => t.type === 'left-bracket')).toBe(true);
    expect(indexTks.some((t) => t.type === 'right-bracket')).toBe(true);
    expect(indexTks.some((t) => t.type === 'int' && t.value === 0)).toBe(true);
  });
});

describe('createTokenizer large-input regression (no stack overflow)', () => {
  test('tokenizes a single ~100KB text run as one data token', () => {
    const textRun = 'a'.repeat(100 * 1024);
    const tks = tokens(textRun);
    const dataTokens = tks.filter((t) => t.type === 'data');
    expect(dataTokens.length).toBe(1);
    expect(dataTokens[0]?.value).toBe(textRun);
  });

  test('lexes a ~50KB raw block', () => {
    const rawBody = 'r'.repeat(50 * 1024);
    const tks = tokens(`{% raw %}${rawBody}{% endraw %}`);
    const rawTokens = tks.filter((t) => t.type === 'raw');
    expect(rawTokens.length).toBe(1);
    expect(String(rawTokens[0]?.value)).toBe(`{% raw %}${rawBody}{% endraw %}`);
  });

  test('lexes a ~100KB comment', () => {
    const commentSource = `{# ${'c'.repeat(100 * 1024)} #}`;
    const tks = tokens(commentSource);
    const commentTokens = tks.filter((t) => t.type === 'comment');
    expect(commentTokens.length).toBe(1);
    expect(String(commentTokens[0]?.value)).toBe(commentSource);
  });

  test('lexes a ~100KB string literal and template literal', () => {
    const literalBody = 's'.repeat(100 * 1024);
    const stringTks = tokens(`{{ "${literalBody}" }}`);
    expect(stringTks.filter((t) => t.type === 'string' && t.value === literalBody).length).toBe(
      1
    );

    const templateTks = tokens(`{{ \`${literalBody}\` }}`);
    const templateTokens = templateTks.filter((t) => t.type === 'template-literal');
    expect(templateTokens.length).toBe(1);
  });

  test('lexes ~10K tokens without generator delegation overhead', () => {
    const chunk = '{{ x }}';
    const tks = tokens(chunk.repeat(10_000));
    expect(tks.filter((t) => t.type === 'variable-start').length).toBe(10_000);
    expect(tks.filter((t) => t.type === 'variable-end').length).toBe(10_000);
  });
});
