import {
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

export const createToken = (type, value, lineno, colno) => ({
  type,
  value,
  lineno,
  colno,
});

export const matchTokenType = (char) => {
  const map = {
    '(' : TOKEN_LEFT_PAREN,
    ')' : TOKEN_RIGHT_PAREN,
    '[' : TOKEN_LEFT_BRACKET,
    ']' : TOKEN_RIGHT_BRACKET,
    '{' : TOKEN_LEFT_CURLY,
    '}' : TOKEN_RIGHT_CURLY,
    ',' : TOKEN_COMMA,
    ':' : TOKEN_COLON,
    '~' : TOKEN_TILDE,
    '|>' : TOKEN_PIPEFORWARD,
  };
  return map[char] ?? TOKEN_OPERATOR;
};

export const createOperatorToken = (char, lineno, colno) => 
  createToken(matchTokenType(char), char, lineno, colno);

export const createNumberToken = (tok, lineno, colno, hasDecimal) => 
  createToken(hasDecimal ? TOKEN_FLOAT : TOKEN_INT, tok, lineno, colno);

export const createSymbolToken = (tok, lineno, colno, isNumeric, isBool, isNull) => {
  if (isNumeric) return null;
  if (isBool) return createToken(TOKEN_BOOLEAN, tok, lineno, colno);
  if (isNull) return createToken(TOKEN_NONE, tok, lineno, colno);
  if (tok) return createToken(TOKEN_SYMBOL, tok, lineno, colno);
  return null;
};
