import { TOKEN_BLOCK_END, TOKEN_FLOAT, TOKEN_INT, TOKEN_SYMBOL, TOKEN_VARIABLE_END } from './token-types.ts';
import type { Token, TokenType, TokenValueByType } from './token-types.ts';

export const createToken = <K extends TokenType>(
  type: K,
  value: TokenValueByType[K],
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
}) as Token;

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
  typeof tok.value === 'string';

export const isSymbolToken = (tok: Token): tok is Token & { type: 'symbol' } =>
  tok.type === TOKEN_SYMBOL && isStringToken(tok);

export const isBlockEndToken = (tok: Token): tok is Token & { type: 'block-end' } =>
  tok.type === TOKEN_BLOCK_END && isStringToken(tok);

export const isVariableEndToken = (tok: Token): tok is Token & { type: 'variable-end' } =>
  tok.type === TOKEN_VARIABLE_END && isStringToken(tok);
