import { describe, test, expect } from 'bun:test';
import { lex } from './tokenizer.js';
import {
  TOKEN_STRING,
  TOKEN_WHITESPACE,
  TOKEN_DATA,
  TOKEN_BLOCK_START,
  TOKEN_VARIABLE_START,
  TOKEN_VARIABLE_END,
  TOKEN_COMMENT,
  TOKEN_LEFT_PAREN,
  TOKEN_RIGHT_PAREN,
  TOKEN_LEFT_BRACKET,
  TOKEN_RIGHT_BRACKET,
  TOKEN_OPERATOR,
  TOKEN_COMMA,
  TOKEN_COLON,
  TOKEN_TILDE,
  TOKEN_PIPEFORWARD,
  TOKEN_INT,
  TOKEN_FLOAT,
  TOKEN_BOOLEAN,
  TOKEN_NONE,
  TOKEN_SYMBOL,
  TOKEN_REGEX,
} from './token-types.js';

const tokenize = (template) => {
  const tokenizer = lex(template);
  const tokens = [];
  let tok;
  while ((tok = tokenizer.nextToken()) !== null) {
    tokens.push(tok);
  }
  return tokens;
};

const getTokensByType = (tokens, type) => tokens.filter(t => t.type === type);
const getTokensByValue = (tokens, value) => tokens.filter(t => t.value === value);
const hasToken = (tokens, type, value) => tokens.some(t => t.type === type && t.value === value);

describe('lex - variable expressions', () => {
  test('tokenizes simple variable', () => {
    const tokens = tokenize('{{ x }}');
    expect(getTokensByType(tokens, TOKEN_VARIABLE_START)).toHaveLength(1);
    expect(getTokensByType(tokens, TOKEN_VARIABLE_END)).toHaveLength(1);
    expect(hasToken(tokens, TOKEN_SYMBOL, 'x')).toBe(true);
  });

  test('tokenizes variable with property access', () => {
    const tokens = tokenize('{{ user.name }}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'user')).toBe(true);
    expect(hasToken(tokens, TOKEN_SYMBOL, 'name')).toBe(true);
    expect(hasToken(tokens, TOKEN_OPERATOR, '.')).toBe(true);
  });

  test('tokenizes bracket notation', () => {
    const tokens = tokenize('{{ arr[0] }}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'arr')).toBe(true);
    expect(hasToken(tokens, TOKEN_LEFT_BRACKET, '[')).toBe(true);
    expect(hasToken(tokens, TOKEN_RIGHT_BRACKET, ']')).toBe(true);
    expect(hasToken(tokens, TOKEN_INT, '0')).toBe(true);
  });

  test('tokenizes nested bracket notation', () => {
    const tokens = tokenize('{{ arr[0][1] }}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'arr')).toBe(true);
    expect(getTokensByValue(tokens, '[')).toHaveLength(2);
    expect(getTokensByValue(tokens, ']')).toHaveLength(2);
    expect(hasToken(tokens, TOKEN_INT, '0')).toBe(true);
    expect(hasToken(tokens, TOKEN_INT, '1')).toBe(true);
  });

  test('tokenizes deep property access', () => {
    const tokens = tokenize('{{ user.profile.settings.theme }}');
    const symbols = getTokensByType(tokens, TOKEN_SYMBOL);
    expect(symbols.map(t => t.value)).toEqual(['user', 'profile', 'settings', 'theme']);
  });
});

describe('lex - block tags', () => {
  test('tokenizes if statement', () => {
    const tokens = tokenize('{% if x %}');
    expect(getTokensByType(tokens, TOKEN_BLOCK_START)).toHaveLength(1);
    expect(hasToken(tokens, TOKEN_SYMBOL, 'if')).toBe(true);
    expect(hasToken(tokens, TOKEN_SYMBOL, 'x')).toBe(true);
  });

  test('tokenizes for loop', () => {
    const tokens = tokenize('{% for i in items %}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'for')).toBe(true);
    expect(hasToken(tokens, TOKEN_SYMBOL, 'i')).toBe(true);
    expect(hasToken(tokens, TOKEN_SYMBOL, 'in')).toBe(true);
    expect(hasToken(tokens, TOKEN_SYMBOL, 'items')).toBe(true);
  });

  test('tokenizes set variable', () => {
    const tokens = tokenize('{% set x = 1 %}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'set')).toBe(true);
    expect(hasToken(tokens, TOKEN_SYMBOL, 'x')).toBe(true);
    expect(hasToken(tokens, TOKEN_OPERATOR, '=')).toBe(true);
    expect(hasToken(tokens, TOKEN_INT, '1')).toBe(true);
  });

  test('tokenizes set with string', () => {
    const tokens = tokenize('{% set name = "Alice" %}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'set')).toBe(true);
    expect(hasToken(tokens, TOKEN_SYMBOL, 'name')).toBe(true);
    expect(hasToken(tokens, TOKEN_STRING, 'Alice')).toBe(true);
  });

  test('tokenizes macro definition', () => {
    const tokens = tokenize('{% macro foo(arg1, arg2) %}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'macro')).toBe(true);
    expect(hasToken(tokens, TOKEN_SYMBOL, 'foo')).toBe(true);
    expect(hasToken(tokens, TOKEN_LEFT_PAREN, '(')).toBe(true);
    expect(hasToken(tokens, TOKEN_RIGHT_PAREN, ')')).toBe(true);
    expect(hasToken(tokens, TOKEN_COMMA, ',')).toBe(true);
  });

  test('tokenizes include', () => {
    const tokens = tokenize('{% include "test.njk" %}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'include')).toBe(true);
    expect(hasToken(tokens, TOKEN_STRING, 'test.njk')).toBe(true);
  });

  test('tokenizes extends', () => {
    const tokens = tokenize('{% extends "base.njk" %}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'extends')).toBe(true);
    expect(hasToken(tokens, TOKEN_STRING, 'base.njk')).toBe(true);
  });

  test('tokenizes block', () => {
    const tokens = tokenize('{% block content %}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'block')).toBe(true);
    expect(hasToken(tokens, TOKEN_SYMBOL, 'content')).toBe(true);
  });
});

describe('lex - arithmetic operators', () => {
  test('tokenizes addition', () => {
    const tokens = tokenize('{{ a + b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '+')).toBe(true);
  });

  test('tokenizes subtraction', () => {
    const tokens = tokenize('{{ a - b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '-')).toBe(true);
  });

  test('tokenizes multiplication', () => {
    const tokens = tokenize('{{ a * b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '*')).toBe(true);
  });

  test('tokenizes division', () => {
    const tokens = tokenize('{{ a / b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '/')).toBe(true);
  });

  test('tokenizes floor division', () => {
    const tokens = tokenize('{{ a // b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '//')).toBe(true);
  });

  test('tokenizes modulo', () => {
    const tokens = tokenize('{{ a % b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '%')).toBe(true);
  });

  test('tokenizes power', () => {
    const tokens = tokenize('{{ a ** b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '**')).toBe(true);
  });
});

describe('lex - comparison operators', () => {
  test('tokenizes ==', () => {
    const tokens = tokenize('{{ a == b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '==')).toBe(true);
  });

  test('tokenizes !=', () => {
    const tokens = tokenize('{{ a != b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '!=')).toBe(true);
  });

  test('tokenizes ===', () => {
    const tokens = tokenize('{{ a === b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '===')).toBe(true);
  });

  test('tokenizes !==', () => {
    const tokens = tokenize('{{ a !== b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '!==')).toBe(true);
  });

  test('tokenizes <', () => {
    const tokens = tokenize('{{ a < b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '<')).toBe(true);
  });

  test('tokenizes >', () => {
    const tokens = tokenize('{{ a > b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '>')).toBe(true);
  });

  test('tokenizes <=', () => {
    const tokens = tokenize('{{ a <= b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '<=')).toBe(true);
  });

  test('tokenizes >=', () => {
    const tokens = tokenize('{{ a >= b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '>=')).toBe(true);
  });
});

describe('lex - logical operators', () => {
  test('tokenizes && operator', () => {
    const tokens = tokenize('{{ a && b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '&&')).toBe(true);
  });

  test('tokenizes || operator', () => {
    const tokens = tokenize('{{ a || b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '||')).toBe(true);
  });

  test('tokenizes ! operator', () => {
    const tokens = tokenize('{{ !a }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '!')).toBe(true);
  });

  test('tokenizes and keyword', () => {
    const tokens = tokenize('{{ a and b }}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'and')).toBe(true);
  });

  test('tokenizes or keyword', () => {
    const tokens = tokenize('{{ a or b }}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'or')).toBe(true);
  });

  test('tokenizes not keyword', () => {
    const tokens = tokenize('{{ not a }}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'not')).toBe(true);
  });

  test('tokenizes complex logical expression with operators', () => {
    const tokens = tokenize('{{ true && false || true }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '&&')).toBe(true);
    expect(hasToken(tokens, TOKEN_OPERATOR, '||')).toBe(true);
  });

  test('tokenizes complex logical expression with keywords', () => {
    const tokens = tokenize('{{ true and false or true }}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'and')).toBe(true);
    expect(hasToken(tokens, TOKEN_SYMBOL, 'or')).toBe(true);
  });
});

describe('lex - other operators', () => {
  test('tokenizes ternary operator', () => {
    const tokens = tokenize('{{ a ? b : c }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '?')).toBe(true);
    expect(hasToken(tokens, TOKEN_COLON, ':')).toBe(true);
  });

  test('tokenizes nullish coalescing', () => {
    const tokens = tokenize('{{ a ?? b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '??')).toBe(true);
  });

  test('tokenizes pipe forward', () => {
    const tokens = tokenize('{{ a |> safe }}');
    expect(hasToken(tokens, TOKEN_PIPEFORWARD, '|>')).toBe(true);
  });

  test('tokenizes tilde for concat', () => {
    const tokens = tokenize('{{ "hello" ~ "world" }}');
    expect(hasToken(tokens, TOKEN_TILDE, '~')).toBe(true);
  });

  test('tokenizes dot operator', () => {
    const tokens = tokenize('{{ a.b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '.')).toBe(true);
  });

  test('tokenizes optional chaining', () => {
    const tokens = tokenize('{{ a?.b }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '?.')).toBe(true);
  });
});

describe('lex - strings', () => {
  test('tokenizes double quoted string', () => {
    const tokens = tokenize('{{ "hello" }}');
    expect(hasToken(tokens, TOKEN_STRING, 'hello')).toBe(true);
  });

  test('tokenizes single quoted string', () => {
    const tokens = tokenize("{{ 'hello' }}");
    expect(hasToken(tokens, TOKEN_STRING, 'hello')).toBe(true);
  });

  test('tokenizes string with escape', () => {
    const tokens = tokenize('{{ "hello\\nworld" }}');
    const strToken = tokens.find(t => t.type === TOKEN_STRING);
    expect(strToken.value).toBe('hello\nworld');
  });

  test('tokenizes escaped quote in string', () => {
    const tokens = tokenize('{{ "say \\"hi\\"" }}');
    const strToken = tokens.find(t => t.type === TOKEN_STRING);
    expect(strToken.value).toBe('say "hi"');
  });

  test('tokenizes empty string double quotes', () => {
    const tokens = tokenize('{{ "" }}');
    expect(hasToken(tokens, TOKEN_STRING, '')).toBe(true);
  });

  test('tokenizes empty string single quotes', () => {
    const tokens = tokenize("{{ '' }}");
    expect(hasToken(tokens, TOKEN_STRING, '')).toBe(true);
  });

  test('handles escaped backslash', () => {
    const tokens = tokenize('{{ "a\\\\b" }}');
    const strToken = tokens.find(t => t.type === TOKEN_STRING);
    expect(strToken.value).toBe('a\\b');
  });
});

describe('lex - numbers', () => {
  test('tokenizes integer', () => {
    const tokens = tokenize('{{ 42 }}');
    expect(hasToken(tokens, TOKEN_INT, '42')).toBe(true);
  });

  test('tokenizes float', () => {
    const tokens = tokenize('{{ 3.14 }}');
    expect(hasToken(tokens, TOKEN_FLOAT, '3.14')).toBe(true);
  });

  test('tokenizes negative integer', () => {
    const tokens = tokenize('{{ -5 }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '-')).toBe(true);
    expect(hasToken(tokens, TOKEN_INT, '5')).toBe(true);
  });

  test('tokenizes negative float', () => {
    const tokens = tokenize('{{ -3.14 }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '-')).toBe(true);
    expect(hasToken(tokens, TOKEN_FLOAT, '3.14')).toBe(true);
  });

  test('tokenizes zero', () => {
    const tokens = tokenize('{{ 0 }}');
    expect(hasToken(tokens, TOKEN_INT, '0')).toBe(true);
  });

  test('tokenizes large number', () => {
    const tokens = tokenize('{{ 1000000 }}');
    expect(hasToken(tokens, TOKEN_INT, '1000000')).toBe(true);
  });
});

describe('lex - booleans and null', () => {
  test('tokenizes true', () => {
    const tokens = tokenize('{{ true }}');
    expect(hasToken(tokens, TOKEN_BOOLEAN, 'true')).toBe(true);
  });

  test('tokenizes false', () => {
    const tokens = tokenize('{{ false }}');
    expect(hasToken(tokens, TOKEN_BOOLEAN, 'false')).toBe(true);
  });

  test('tokenizes none', () => {
    const tokens = tokenize('{{ none }}');
    expect(hasToken(tokens, TOKEN_NONE, 'none')).toBe(true);
  });

  test('tokenizes null', () => {
    const tokens = tokenize('{{ null }}');
    expect(hasToken(tokens, TOKEN_NONE, 'null')).toBe(true);
  });
});

describe('lex - comments', () => {
  test('tokenizes single line comment', () => {
    const tokens = tokenize('{# comment #}');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ type: TOKEN_COMMENT, value: '{# comment #}' });
  });

  test('tokenizes comment with multiple words', () => {
    const tokens = tokenize('{# this is a comment #}');
    expect(tokens[0].value).toBe('{# this is a comment #}');
  });

  test('tokenizes comment without spaces', () => {
    const tokens = tokenize('{#comment#}');
    expect(tokens[0].value).toBe('{#comment#}');
  });

  test('template text before and after comment', () => {
    const tokens = tokenize('hello {# comment #} world');
    expect(getTokensByType(tokens, TOKEN_DATA)).toHaveLength(2);
    expect(hasToken(tokens, TOKEN_COMMENT, '{# comment #}')).toBe(true);
  });
});

describe('lex - whitespace handling', () => {
  test('tokenizes with no spaces', () => {
    const tokens = tokenize('{{x}}');
    expect(getTokensByType(tokens, TOKEN_WHITESPACE)).toHaveLength(0);
  });

  test('tokenizes with extra spaces', () => {
    const tokens = tokenize('{{  x  }}');
    const ws = getTokensByType(tokens, TOKEN_WHITESPACE);
    expect(ws.length).toBeGreaterThan(0);
  });

  test('tokenizes block with no spaces', () => {
    const tokens = tokenize('{%if x%}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'if')).toBe(true);
    expect(hasToken(tokens, TOKEN_SYMBOL, 'x')).toBe(true);
  });
});

describe('lex - mixed access patterns', () => {
  test('tokenizes items[0].name', () => {
    const tokens = tokenize('{{ items[0].name }}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'items')).toBe(true);
    expect(hasToken(tokens, TOKEN_INT, '0')).toBe(true);
    expect(hasToken(tokens, TOKEN_SYMBOL, 'name')).toBe(true);
  });

  test('tokenizes function call', () => {
    const tokens = tokenize('{{ fn(arg1, arg2) }}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'fn')).toBe(true);
    expect(hasToken(tokens, TOKEN_LEFT_PAREN, '(')).toBe(true);
    expect(hasToken(tokens, TOKEN_RIGHT_PAREN, ')')).toBe(true);
    expect(hasToken(tokens, TOKEN_COMMA, ',')).toBe(true);
  });

  test('tokenizes nested function call', () => {
    const tokens = tokenize('{{ fn(arr[0]) }}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'fn')).toBe(true);
    expect(hasToken(tokens, TOKEN_INT, '0')).toBe(true);
  });
});

describe('lex - complex expressions', () => {
  test('tokenizes operator precedence with && and ||', () => {
    const tokens = tokenize('{{ a && b || c }}');
    const ops = getTokensByType(tokens, TOKEN_OPERATOR);
    expect(ops.map(t => t.value)).toContain('&&');
    expect(ops.map(t => t.value)).toContain('||');
  });

  test('tokenizes comparison chain', () => {
    const tokens = tokenize('{{ a == b && c != d }}');
    const ops = getTokensByType(tokens, TOKEN_OPERATOR);
    expect(ops.map(t => t.value)).toEqual(['==', '&&', '!=']);
  });

  test('tokenizes unary not with comparison', () => {
    const tokens = tokenize('{{ not a == b }}');
    expect(hasToken(tokens, TOKEN_SYMBOL, 'not')).toBe(true);
  });

  test('tokenizes negation with !', () => {
    const tokens = tokenize('{{ !true }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '!')).toBe(true);
    expect(hasToken(tokens, TOKEN_BOOLEAN, 'true')).toBe(true);
  });

  test('tokenizes ternary with expressions', () => {
    const tokens = tokenize('{{ x ? a + b : c - d }}');
    expect(hasToken(tokens, TOKEN_OPERATOR, '?')).toBe(true);
    expect(hasToken(tokens, TOKEN_COLON, ':')).toBe(true);
  });
});

describe('lex - regex', () => {
  test('tokenizes simple regex', () => {
    const tokens = tokenize('{{ r/test/ }}');
    const regexTokens = getTokensByType(tokens, TOKEN_REGEX);
    expect(regexTokens).toHaveLength(1);
    expect(regexTokens[0].value.body).toBe('test');
    expect(regexTokens[0].value.flags).toBe('');
  });

  test('tokenizes regex with flags', () => {
    const tokens = tokenize('{{ r/test/gi }}');
    const regexTokens = getTokensByType(tokens, TOKEN_REGEX);
    expect(regexTokens[0].value.body).toBe('test');
    expect(regexTokens[0].value.flags).toBe('gi');
  });

  test('tokenizes empty regex', () => {
    const tokens = tokenize('{{ r/// }}');
    const regexTokens = getTokensByType(tokens, TOKEN_REGEX);
    expect(regexTokens[0].value.body).toBe('');
    expect(regexTokens[0].value.flags).toBe('');
  });
});

describe('lex - plain text', () => {
  test('tokenizes plain text as DATA', () => {
    const tokens = tokenize('hello world');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ type: TOKEN_DATA, value: 'hello world' });
  });

  test('tokenizes text before and after variable', () => {
    const tokens = tokenize('Hello {{ name }}!');
    expect(getTokensByType(tokens, TOKEN_DATA)).toHaveLength(2);
  });

  test('tokenizes text before and after block', () => {
    const tokens = tokenize('{% if x %}yes{% endif %}');
    expect(getTokensByType(tokens, TOKEN_DATA)).toHaveLength(1);
    expect(tokens.find(t => t.value === 'yes')).toBeTruthy();
  });
});

describe('lex - line and column tracking', () => {
  test('tracks colno correctly', () => {
    const tokens = tokenize('abc');
    expect(tokens[0].colno).toBe(0);
  });

  test('handles multiline template', () => {
    const tokens = tokenize('{{ x }}\n{{ y }}');
    expect(getTokensByType(tokens, TOKEN_VARIABLE_START)).toHaveLength(2);
    expect(getTokensByType(tokens, TOKEN_VARIABLE_END)).toHaveLength(2);
  });

  test('preserves newlines in data tokens', () => {
    const tokens = tokenize('line1\nline2');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].value).toContain('\n');
  });
});
