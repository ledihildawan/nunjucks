import { describe, test, expect } from 'bun:test';
import { lex, createTokenizer } from './lexer.ts';
import {
  TOKEN_VARIABLE_START,
  TOKEN_VARIABLE_END,
  TOKEN_BLOCK_START,
  TOKEN_BLOCK_END,
  TOKEN_COMMENT,
  TOKEN_DATA,
  TOKEN_WHITESPACE,
  TOKEN_SYMBOL,
  TOKEN_STRING,
  TOKEN_INT,
  TOKEN_FLOAT,
  TOKEN_BOOLEAN,
  TOKEN_NONE,
  TOKEN_OPERATOR,
} from './token-types.ts';
import type { Token } from './token-types.ts';

const collect = (src: string, opts?: Parameters<typeof lex>[1]): Token[] => {
  const tokenizer = lex(src, opts);
  const tokens: Token[] = [];
  let token: Token | null;
  while ((token = tokenizer.nextToken()) !== null) tokens.push(token);
  return tokens;
};

const types = (tokens: Token[]) => tokens.map((t) => t.type);

describe('lex - variable interpolation', () => {
  test('lexes {{ variable }} into expected token stream', () => {
    const tokens = collect('{{ variable }}');
    expect(types(tokens)).toEqual([
      TOKEN_VARIABLE_START,
      TOKEN_WHITESPACE,
      TOKEN_SYMBOL,
      TOKEN_WHITESPACE,
      TOKEN_VARIABLE_END,
    ]);
    expect(tokens[0].value).toBe('{{');
    expect(tokens[2].value).toBe('variable');
    expect(tokens[4].value).toBe('}}');
  });

  test('lexes {{x}} without whitespace', () => {
    const tokens = collect('{{x}}');
    expect(types(tokens)).toEqual([
      TOKEN_VARIABLE_START,
      TOKEN_SYMBOL,
      TOKEN_VARIABLE_END,
    ]);
    expect(tokens[1].value).toBe('x');
  });

  test('lexes multiple interpolations', () => {
    const tokens = collect('{{ a }}{{ b }}');
    const starts = tokens.filter((t) => t.type === TOKEN_VARIABLE_START);
    const symbols = tokens.filter((t) => t.type === TOKEN_SYMBOL);
    expect(starts).toHaveLength(2);
    expect(symbols.map((t) => t.value)).toEqual(['a', 'b']);
  });
});

describe('lex - block tags', () => {
  test('lexes {% if x %} into block tokens', () => {
    const tokens = collect('{% if x %}');
    expect(types(tokens)).toEqual([
      TOKEN_BLOCK_START,
      TOKEN_WHITESPACE,
      TOKEN_SYMBOL,
      TOKEN_WHITESPACE,
      TOKEN_SYMBOL,
      TOKEN_WHITESPACE,
      TOKEN_BLOCK_END,
    ]);
    expect(tokens[0].value).toBe('{%');
    expect(tokens[2].value).toBe('if');
    expect(tokens[4].value).toBe('x');
    expect(tokens[6].value).toBe('%}');
  });

  test('lexes {% for i in items %}', () => {
    const tokens = collect('{% for i in items %}');
    const symbols = tokens
      .filter((t) => t.type === TOKEN_SYMBOL)
      .map((t) => t.value);
    expect(symbols).toEqual(['for', 'i', 'in', 'items']);
  });

  test('lexes {%endif%} without whitespace', () => {
    const tokens = collect('{%endif%}');
    expect(types(tokens)).toEqual([
      TOKEN_BLOCK_START,
      TOKEN_SYMBOL,
      TOKEN_BLOCK_END,
    ]);
  });
});

describe('lex - comments', () => {
  test('lexes {# comment #} into a single comment token', () => {
    const tokens = collect('{# comment #}');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe(TOKEN_COMMENT);
    expect(tokens[0].value).toBe('{# comment #}');
  });

  test('lexes empty comment {##}', () => {
    const tokens = collect('{##}');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe(TOKEN_COMMENT);
    expect(tokens[0].value).toBe('{##}');
  });

  test('lexes comment containing delimiters-like text', () => {
    const tokens = collect('{# a {{ b }} c #}');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe(TOKEN_COMMENT);
    expect(tokens[0].value).toBe('{# a {{ b }} c #}');
  });
});

describe('lex - raw text', () => {
  test('lexes plain text into a data token', () => {
    const tokens = collect('hello world');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe(TOKEN_DATA);
    expect(tokens[0].value).toBe('hello world');
  });

  test('lexes text adjacent to interpolation', () => {
    const tokens = collect('Hello {{ name }}!');
    expect(tokens[0].type).toBe(TOKEN_DATA);
    expect(tokens[0].value).toBe('Hello ');
    expect(tokens[tokens.length - 1].type).toBe(TOKEN_DATA);
    expect(tokens[tokens.length - 1].value).toBe('!');
  });
});

describe('lex - empty input', () => {
  test('lexes empty string into no tokens', () => {
    expect(collect('')).toEqual([]);
  });

  test('nextToken returns null immediately for empty string', () => {
    const tokenizer = lex('');
    expect(tokenizer.nextToken()).toBeNull();
  });

  test('nextToken returns null after exhaustion', () => {
    const tokenizer = lex('hi');
    expect(tokenizer.nextToken()).not.toBeNull();
    expect(tokenizer.nextToken()).toBeNull();
    expect(tokenizer.nextToken()).toBeNull();
  });
});

describe('lex - token positions', () => {
  test('first token starts at line 0, column 0', () => {
    const [first] = collect('{{ x }}');
    expect(first.lineno).toBe(0);
    expect(first.colno).toBe(0);
  });

  test('tracks advancing column position', () => {
    const tokens = collect('{{ x }}');
    expect(tokens[0].colno).toBe(0);
    expect(tokens[1].colno).toBe(2);
  });

  test('tracks line number across newlines', () => {
    const tokens = collect('a\n{{ x }}');
    expect(tokens[0].type).toBe(TOKEN_DATA);
    expect(tokens[0].value).toBe('a\n');
    const varStart = tokens[1];
    expect(varStart.type).toBe(TOKEN_VARIABLE_START);
    expect(varStart.lineno).toBe(1);
  });

  test('resets column after newline', () => {
    const tokens = collect('ab\ncd');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe(TOKEN_DATA);
    expect(tokens[0].value).toBe('ab\ncd');
  });
});

describe('lex - code expressions', () => {
  test('lexes an integer literal', () => {
    const tokens = collect('{{ 42 }}');
    expect(tokens[2].type).toBe(TOKEN_INT);
    expect(tokens[2].value).toBe(42);
  });

  test('lexes a float literal', () => {
    const tokens = collect('{{ 3.14 }}');
    expect(tokens[2].type).toBe(TOKEN_FLOAT);
    expect(tokens[2].value).toBe(3.14);
  });

  test('lexes a double-quoted string literal', () => {
    const tokens = collect('{{ "hi" }}');
    expect(tokens[2].type).toBe(TOKEN_STRING);
    expect(tokens[2].value).toBe('hi');
  });

  test('lexes a single-quoted string literal', () => {
    const tokens = collect("{{ 'hi' }}");
    expect(tokens[2].type).toBe(TOKEN_STRING);
    expect(tokens[2].value).toBe('hi');
  });

  test('lexes a boolean literal', () => {
    const tokens = collect('{{ true }}');
    expect(tokens[2].type).toBe(TOKEN_BOOLEAN);
    expect(tokens[2].value).toBe('true');
  });

  test('lexes a none literal', () => {
    const tokens = collect('{{ none }}');
    expect(tokens[2].type).toBe(TOKEN_NONE);
    expect(tokens[2].value).toBe('none');
  });

  test('lexes an arithmetic operator', () => {
    const tokens = collect('{{ 1 + 2 }}');
    const ops = tokens.filter((t) => t.type === TOKEN_OPERATOR);
    expect(ops).toHaveLength(1);
    expect(ops[0].value).toBe('+');
  });
});

describe('lex - custom delimiters', () => {
  test('supports custom variable delimiters', () => {
    const tokens = collect('<< x >>', {
      tags: { variableStart: '<<', variableEnd: '>>' },
    });
    expect(types(tokens)).toEqual([
      TOKEN_VARIABLE_START,
      TOKEN_WHITESPACE,
      TOKEN_SYMBOL,
      TOKEN_WHITESPACE,
      TOKEN_VARIABLE_END,
    ]);
    expect(tokens[0].value).toBe('<<');
    expect(tokens[4].value).toBe('>>');
  });

  test('supports custom block delimiters', () => {
    const tokens = collect('<% if x %>', {
      tags: { blockStart: '<%', blockEnd: '%>' },
    });
    expect(tokens[0].type).toBe(TOKEN_BLOCK_START);
    expect(tokens[0].value).toBe('<%');
    expect(tokens[tokens.length - 1].type).toBe(TOKEN_BLOCK_END);
    expect(tokens[tokens.length - 1].value).toBe('%>');
  });

  test('default delimiters are exposed via tags', () => {
    const tokenizer = lex('');
    expect(tokenizer.tags.VARIABLE_START).toBe('{{');
    expect(tokenizer.tags.VARIABLE_END).toBe('}}');
    expect(tokenizer.tags.BLOCK_START).toBe('{%');
    expect(tokenizer.tags.BLOCK_END).toBe('%}');
    expect(tokenizer.tags.COMMENT_START).toBe('{#');
    expect(tokenizer.tags.COMMENT_END).toBe('#}');
  });
});

describe('lex - returned tokenizer object', () => {
  test('exposes trimBlocks and lstripBlocks options', () => {
    const tokenizer = lex('x', { trimBlocks: true, lstripBlocks: true });
    expect(tokenizer.trimBlocks).toBe(true);
    expect(tokenizer.lstripBlocks).toBe(true);
  });

  test('defaults trimBlocks and lstripBlocks to false', () => {
    const tokenizer = lex('x');
    expect(tokenizer.trimBlocks).toBe(false);
    expect(tokenizer.lstripBlocks).toBe(false);
  });

  test('createTokenizer is an alias of lex', () => {
    expect(createTokenizer).toBe(lex);
  });
});
