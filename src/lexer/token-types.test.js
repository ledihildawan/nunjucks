import { expect, describe, test } from 'bun:test';
import {
  TOKEN_STRING, TOKEN_WHITESPACE, TOKEN_DATA,
  TOKEN_BLOCK_START, TOKEN_BLOCK_END,
  TOKEN_VARIABLE_START, TOKEN_VARIABLE_END,
  TOKEN_COMMENT,
  TOKEN_LEFT_PAREN, TOKEN_RIGHT_PAREN,
  TOKEN_LEFT_BRACKET, TOKEN_RIGHT_BRACKET,
  TOKEN_LEFT_CURLY, TOKEN_RIGHT_CURLY,
  TOKEN_OPERATOR, TOKEN_COMMA, TOKEN_COLON,
  TOKEN_TILDE, TOKEN_PIPEFORWARD,
  TOKEN_INT, TOKEN_FLOAT, TOKEN_BOOLEAN,
  TOKEN_NONE, TOKEN_SYMBOL, TOKEN_SPECIAL, TOKEN_REGEX,
  TOKEN_TYPES,
} from './token-types.js';

describe('token type constants', () => {
  const expected = [
    ['TOKEN_STRING', 'string'],
    ['TOKEN_WHITESPACE', 'whitespace'],
    ['TOKEN_DATA', 'data'],
    ['TOKEN_BLOCK_START', 'block-start'],
    ['TOKEN_BLOCK_END', 'block-end'],
    ['TOKEN_VARIABLE_START', 'variable-start'],
    ['TOKEN_VARIABLE_END', 'variable-end'],
    ['TOKEN_COMMENT', 'comment'],
    ['TOKEN_LEFT_PAREN', 'left-paren'],
    ['TOKEN_RIGHT_PAREN', 'right-paren'],
    ['TOKEN_LEFT_BRACKET', 'left-bracket'],
    ['TOKEN_RIGHT_BRACKET', 'right-bracket'],
    ['TOKEN_LEFT_CURLY', 'left-curly'],
    ['TOKEN_RIGHT_CURLY', 'right-curly'],
    ['TOKEN_OPERATOR', 'operator'],
    ['TOKEN_COMMA', 'comma'],
    ['TOKEN_COLON', 'colon'],
    ['TOKEN_TILDE', 'tilde'],
    ['TOKEN_PIPEFORWARD', 'pipe-forward'],
    ['TOKEN_INT', 'int'],
    ['TOKEN_FLOAT', 'float'],
    ['TOKEN_BOOLEAN', 'boolean'],
    ['TOKEN_NONE', 'none'],
    ['TOKEN_SYMBOL', 'symbol'],
    ['TOKEN_SPECIAL', 'special'],
    ['TOKEN_REGEX', 'regex'],
  ];

  test.each(expected)('%s has value %s', (name, expectedValue) => {
    const actual = { TOKEN_STRING, TOKEN_WHITESPACE, TOKEN_DATA, TOKEN_BLOCK_START, TOKEN_BLOCK_END, TOKEN_VARIABLE_START, TOKEN_VARIABLE_END, TOKEN_COMMENT, TOKEN_LEFT_PAREN, TOKEN_RIGHT_PAREN, TOKEN_LEFT_BRACKET, TOKEN_RIGHT_BRACKET, TOKEN_LEFT_CURLY, TOKEN_RIGHT_CURLY, TOKEN_OPERATOR, TOKEN_COMMA, TOKEN_COLON, TOKEN_TILDE, TOKEN_PIPEFORWARD, TOKEN_INT, TOKEN_FLOAT, TOKEN_BOOLEAN, TOKEN_NONE, TOKEN_SYMBOL, TOKEN_SPECIAL, TOKEN_REGEX }[name];
    expect(actual).toBe(expectedValue);
  });
});

describe('TOKEN_TYPES map', () => {
  test('contains all token types', () => {
    expect(TOKEN_TYPES.STRING).toBe('string');
    expect(TOKEN_TYPES.WHITESPACE).toBe('whitespace');
    expect(TOKEN_TYPES.DATA).toBe('data');
    expect(TOKEN_TYPES.BLOCK_START).toBe('block-start');
    expect(TOKEN_TYPES.BLOCK_END).toBe('block-end');
    expect(TOKEN_TYPES.VARIABLE_START).toBe('variable-start');
    expect(TOKEN_TYPES.VARIABLE_END).toBe('variable-end');
    expect(TOKEN_TYPES.COMMENT).toBe('comment');
    expect(TOKEN_TYPES.LEFT_PAREN).toBe('left-paren');
    expect(TOKEN_TYPES.RIGHT_PAREN).toBe('right-paren');
    expect(TOKEN_TYPES.LEFT_BRACKET).toBe('left-bracket');
    expect(TOKEN_TYPES.RIGHT_BRACKET).toBe('right-bracket');
    expect(TOKEN_TYPES.LEFT_CURLY).toBe('left-curly');
    expect(TOKEN_TYPES.RIGHT_CURLY).toBe('right-curly');
    expect(TOKEN_TYPES.OPERATOR).toBe('operator');
    expect(TOKEN_TYPES.COMMA).toBe('comma');
    expect(TOKEN_TYPES.COLON).toBe('colon');
    expect(TOKEN_TYPES.TILDE).toBe('tilde');
    expect(TOKEN_TYPES.PIPEFORWARD).toBe('pipe-forward');
    expect(TOKEN_TYPES.INT).toBe('int');
    expect(TOKEN_TYPES.FLOAT).toBe('float');
    expect(TOKEN_TYPES.BOOLEAN).toBe('boolean');
    expect(TOKEN_TYPES.NONE).toBe('none');
    expect(TOKEN_TYPES.SYMBOL).toBe('symbol');
    expect(TOKEN_TYPES.SPECIAL).toBe('special');
    expect(TOKEN_TYPES.REGEX).toBe('regex');
  });

  test('has exactly 28 entries', () => {
    expect(Object.keys(TOKEN_TYPES)).toHaveLength(28);
  });
});
