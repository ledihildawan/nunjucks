import { TOKEN_BLOCK_END, TOKEN_FLOAT, TOKEN_INT, TOKEN_OPERATOR, TOKEN_SYMBOL, TOKEN_VARIABLE_END } from './token-types.ts';
import type { Token, TokenType, TokenValue } from './token-types.ts';

export const createToken = (
  type: TokenType,
  value: TokenValue,
  lineno: number,
  colno: number,
  strip?: { stripLeft?: boolean; stripRight?: boolean }
): Token => ({
  type,
  value,
  lineno,
  colno,
  ...(strip?.stripLeft && { stripLeft: true }),
  ...(strip?.stripRight && { stripRight: true }),
});

export const createNumberToken = (
  value: number,
  lineno: number,
  colno: number,
  hasDecimal: boolean
): Token => {
  const type: TokenType = hasDecimal ? TOKEN_FLOAT : TOKEN_INT;
  return createToken(type, value, lineno, colno);
};

export const isStringToken = (tok: Token): tok is Token & { value: string } =>
  tok.value !== null && typeof tok.value === 'string';

export const isSymbolToken = (tok: Token): tok is Token & { value: string } =>
  tok.type === TOKEN_SYMBOL && isStringToken(tok);

export const isBlockEndToken = (tok: Token): tok is Token & { value: string } =>
  tok.type === TOKEN_BLOCK_END && isStringToken(tok);

export const isVariableEndToken = (tok: Token): tok is Token & { value: string } =>
  tok.type === TOKEN_VARIABLE_END && isStringToken(tok);

export const isOperatorToken = (tok: Token): tok is Token & { value: string } =>
  tok.type === TOKEN_OPERATOR && isStringToken(tok);
