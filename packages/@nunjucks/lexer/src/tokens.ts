import type { Token, TokenType, TokenValue } from './token-types';

export const createToken = (
  type: TokenType,
  value: TokenValue,
  lineno: number,
  colno: number
): Token => ({
  type,
  value,
  lineno,
  colno,
});

export const createOperatorToken = (
  value: string,
  lineno: number,
  colno: number
): Token => createToken('operator' as TokenType, value, lineno, colno);

export const createNumberToken = (
  value: number,
  lineno: number,
  colno: number,
  hasDecimal: boolean
): Token =>
  createToken(
    (hasDecimal ? 'float' : 'int') as TokenType,
    value,
    lineno,
    colno
  );
