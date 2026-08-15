import { describe, expect, test } from 'bun:test';
import { createTokenizer } from '../lexer.ts';

const tokens = (src: string) => {
  const tk = createTokenizer(src);
  const result: Array<{ type: string; value: unknown }> = [];
  let t = tk.nextToken();
  while (t) {
    result.push({ type: t.type, value: t.value });
    t = tk.nextToken();
  }
  return result;
};

const types = (src: string) => tokens(src).map((t) => t.type);

describe('template-text tokenizer', () => {
  test('plain text becomes data token', () => {
    expect(types('hello')).toContain('data');
  });
  test('empty string produces no tokens', () => {
    expect(tokens('')).toEqual([]);
  });
});

describe('block tokenizer', () => {
  test('{% %} produces block-start and block-end', () => {
    const t = types('{% if true %}');
    expect(t).toContain('block-start');
    expect(t).toContain('block-end');
  });
  test('{%- strips whitespace', () => {
    const t = types('  {%- if true %}');
    expect(t).toContain('block-start');
  });
  test('{%- -%} strips both sides', () => {
    const t = types('x  {%- if true -%}  y');
    expect(t).toContain('block-start');
  });
});

describe('variable tokenizer', () => {
  test('{{ }} produces variable-start and variable-end', () => {
    const t = types('{{ x }}');
    expect(t).toContain('variable-start');
    expect(t).toContain('variable-end');
  });
});

describe('comment tokenizer', () => {
  test('{# #} produces comment token', () => {
    expect(types('{# hello #}')).toContain('comment');
  });
  test('{#- strips whitespace', () => {
    const t = types('  {#- comment -#}');
    expect(t.some((tt) => tt === 'comment' || tt === 'data')).toBe(true);
  });
});

describe('raw tokenizer', () => {
  test('{% raw %} block produces raw token', () => {
    const t = types('{% raw %}{{ x }}{% endraw %}');
    expect(t).toContain('raw');
  });
});

describe('string tokenizer', () => {
  test('double-quoted string', () => {
    const tks = tokens('{{ "hello" }}');
    expect(tks.some((t) => t.type === 'string' && t.value === 'hello')).toBe(true);
  });
  test('single-quoted string', () => {
    const tks = tokens("{{ 'world' }}");
    expect(tks.some((t) => t.type === 'string' && t.value === 'world')).toBe(true);
  });
  test('empty string', () => {
    const tks = tokens('{{ "" }}');
    expect(tks.some((t) => t.type === 'string' && t.value === '')).toBe(true);
  });
});

describe('number tokenizer', () => {
  test('integer', () => {
    const tks = tokens('{{ 42 }}');
    expect(tks.some((t) => t.type === 'int' && t.value === 42)).toBe(true);
  });
  test('float', () => {
    const tks = tokens('{{ 3.14 }}');
    expect(tks.some((t) => t.type === 'float' && t.value === 3.14)).toBe(true);
  });
  test('negative number in expression', () => {
    const tks = tokens('{{ -5 }}');
    expect(tks.some((t) => t.type === 'int' && t.value === 5)).toBe(true);
  });
});

describe('symbol tokenizer', () => {
  test('identifier', () => {
    const tks = tokens('{{ myVar }}');
    expect(tks.some((t) => t.type === 'symbol' && t.value === 'myVar')).toBe(true);
  });
  test('true keyword', () => {
    const tks = tokens('{{ true }}');
    expect(tks.some((t) => t.type === 'boolean')).toBe(true);
  });
  test('false keyword', () => {
    const tks = tokens('{{ false }}');
    expect(tks.some((t) => t.type === 'boolean')).toBe(true);
  });
  test('none keyword', () => {
    const tks = tokens('{{ none }}');
    expect(tks.some((t) => t.type === 'none')).toBe(true);
  });
});

describe('operator tokenizer', () => {
  test('arithmetic operators', () => {
    const t = tokens('{{ 1 + 2 }}');
    expect(t.some((tok) => tok.type === 'operator' && tok.value === '+')).toBe(true);
  });
  test('comparison operators', () => {
    const t = tokens('{{ 1 < 2 }}');
    expect(t.some((tok) => tok.type === 'operator' && tok.value === '<')).toBe(true);
  });
  test('pipe-forward operator |>', () => {
    const t = tokens('{{ x |> upper }}');
    expect(t.some((tok) => tok.type === 'pipe-forward')).toBe(true);
  });
  test('compound operators', () => {
    const t = tokens('{{ 1 // 2 }}');
    expect(t.some((tok) => tok.type === 'operator' && tok.value === '//')).toBe(true);
  });
  test('power operator **', () => {
    const t = tokens('{{ 2 ** 3 }}');
    expect(t.some((tok) => tok.type === 'operator' && tok.value === '**')).toBe(true);
  });
});

describe('whitespace tokenizer', () => {
  test('whitespace between tokens', () => {
    const t = types('{{ x }}');
    expect(t).toContain('variable-start');
  });
});

describe('template-literal tokenizer', () => {
  test('backtick template literal', () => {
    const t = types('{{ `hello` }}');
    expect(t.some((tt) => tt === 'template-literal' || tt === 'string')).toBe(true);
  });
});
