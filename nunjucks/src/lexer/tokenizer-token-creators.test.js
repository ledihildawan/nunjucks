import { describe, test, expect } from 'bun:test';
import {
  createToken,
  matchTokenType,
  createOperatorToken,
  createNumberToken,
  createSymbolToken,
} from './tokenizer-token-creators.js';
import {
  TOKEN_STRING,
  TOKEN_WHITESPACE,
  TOKEN_DATA,
  TOKEN_BLOCK_START,
  TOKEN_BLOCK_END,
  TOKEN_VARIABLE_START,
  TOKEN_VARIABLE_END,
  TOKEN_COMMENT,
  TOKEN_LEFT_PAREN,
  TOKEN_RIGHT_PAREN,
  TOKEN_LEFT_BRACKET,
  TOKEN_RIGHT_BRACKET,
  TOKEN_LEFT_CURLY,
  TOKEN_RIGHT_CURLY,
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
} from './token-types.js';

describe('createToken', () => {
  test('creates token with all fields', () => {
    const tok = createToken('TYPE', 'value', 1, 2);
    expect(tok).toEqual({ type: 'TYPE', value: 'value', lineno: 1, colno: 2 });
  });

  test('creates token with empty value', () => {
    const tok = createToken('TYPE', '', 0, 0);
    expect(tok).toEqual({ type: 'TYPE', value: '', lineno: 0, colno: 0 });
  });

  test('creates token with numeric value', () => {
    const tok = createToken(TOKEN_INT, 42, 5, 10);
    expect(tok).toEqual({ type: TOKEN_INT, value: 42, lineno: 5, colno: 10 });
  });
});

describe('matchTokenType', () => {
  test('matches left paren', () => {
    expect(matchTokenType('(')).toBe(TOKEN_LEFT_PAREN);
  });

  test('matches right paren', () => {
    expect(matchTokenType(')')).toBe(TOKEN_RIGHT_PAREN);
  });

  test('matches left bracket', () => {
    expect(matchTokenType('[')).toBe(TOKEN_LEFT_BRACKET);
  });

  test('matches right bracket', () => {
    expect(matchTokenType(']')).toBe(TOKEN_RIGHT_BRACKET);
  });

  test('matches left curly', () => {
    expect(matchTokenType('{')).toBe(TOKEN_LEFT_CURLY);
  });

  test('matches right curly', () => {
    expect(matchTokenType('}')).toBe(TOKEN_RIGHT_CURLY);
  });

  test('matches comma', () => {
    expect(matchTokenType(',')).toBe(TOKEN_COMMA);
  });

  test('matches colon', () => {
    expect(matchTokenType(':')).toBe(TOKEN_COLON);
  });

  test('matches tilde', () => {
    expect(matchTokenType('~')).toBe(TOKEN_TILDE);
  });

  test('matches pipe forward', () => {
    expect(matchTokenType('|>')).toBe(TOKEN_PIPEFORWARD);
  });

  test('returns OPERATOR for unknown chars', () => {
    expect(matchTokenType('@')).toBe(TOKEN_OPERATOR);
    expect(matchTokenType('#')).toBe(TOKEN_OPERATOR);
    expect(matchTokenType('$')).toBe(TOKEN_OPERATOR);
  });
});

describe('createOperatorToken', () => {
  test('creates operator token for parens', () => {
    const tok = createOperatorToken('(', 1, 2);
    expect(tok.type).toBe(TOKEN_LEFT_PAREN);
    expect(tok.value).toBe('(');
    expect(tok.lineno).toBe(1);
    expect(tok.colno).toBe(2);
  });

  test('creates operator token for brackets', () => {
    const tok = createOperatorToken('[', 0, 0);
    expect(tok.type).toBe(TOKEN_LEFT_BRACKET);
  });

  test('creates operator token for curly', () => {
    const tok = createOperatorToken('{', 0, 0);
    expect(tok.type).toBe(TOKEN_LEFT_CURLY);
  });

  test('creates operator token for pipe forward', () => {
    const tok = createOperatorToken('|>', 0, 0);
    expect(tok.type).toBe(TOKEN_PIPEFORWARD);
  });

  test('creates generic operator token', () => {
    const tok = createOperatorToken('@', 0, 0);
    expect(tok.type).toBe(TOKEN_OPERATOR);
  });
});

describe('createNumberToken', () => {
  test('creates integer token', () => {
    const tok = createNumberToken('42', 1, 2, false);
    expect(tok.type).toBe(TOKEN_INT);
    expect(tok.value).toBe('42');
    expect(tok.lineno).toBe(1);
    expect(tok.colno).toBe(2);
  });

  test('creates float token', () => {
    const tok = createNumberToken('3.14', 1, 2, true);
    expect(tok.type).toBe(TOKEN_FLOAT);
    expect(tok.value).toBe('3.14');
  });

  test('creates negative integer', () => {
    const tok = createNumberToken('-10', 0, 0, false);
    expect(tok.type).toBe(TOKEN_INT);
    expect(tok.value).toBe('-10');
  });

  test('creates negative float', () => {
    const tok = createNumberToken('-5.5', 0, 0, true);
    expect(tok.type).toBe(TOKEN_FLOAT);
    expect(tok.value).toBe('-5.5');
  });
});

describe('createSymbolToken', () => {
  test('returns null for numeric strings', () => {
    const tok = createSymbolToken('123', 0, 0, true, false, false);
    expect(tok).toBeNull();
  });

  test('creates boolean token for true', () => {
    const tok = createSymbolToken('true', 0, 0, false, true, false);
    expect(tok.type).toBe(TOKEN_BOOLEAN);
    expect(tok.value).toBe('true');
  });

  test('creates boolean token for false', () => {
    const tok = createSymbolToken('false', 0, 0, false, true, false);
    expect(tok.type).toBe(TOKEN_BOOLEAN);
    expect(tok.value).toBe('false');
  });

  test('creates none token for none', () => {
    const tok = createSymbolToken('none', 0, 0, false, false, true);
    expect(tok.type).toBe(TOKEN_NONE);
    expect(tok.value).toBe('none');
  });

  test('creates none token for null', () => {
    const tok = createSymbolToken('null', 0, 0, false, false, true);
    expect(tok.type).toBe(TOKEN_NONE);
    expect(tok.value).toBe('null');
  });

  test('creates symbol token for regular identifier', () => {
    const tok = createSymbolToken('foo', 0, 0, false, false, false);
    expect(tok.type).toBe(TOKEN_SYMBOL);
    expect(tok.value).toBe('foo');
  });

  test('creates symbol token for underscore identifier', () => {
    const tok = createSymbolToken('_private', 0, 0, false, false, false);
    expect(tok.type).toBe(TOKEN_SYMBOL);
    expect(tok.value).toBe('_private');
  });

  test('returns null for empty string', () => {
    const tok = createSymbolToken('', 0, 0, false, false, false);
    expect(tok).toBeNull();
  });
});
