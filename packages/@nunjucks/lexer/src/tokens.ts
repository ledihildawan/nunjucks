import type { Token, TokenType, TokenValue } from './token-types.ts';

// biome-ignore lint/complexity/useMaxParams: bundling lineno/colno into an object would allocate one throwaway object per token in the tokenizer's hot path, across 24 call sites, to satisfy a parameter count.
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
): Token => {
  let type: TokenType;
  if (hasDecimal) {
    type = 'float' as TokenType;
  } else {
    type = 'int' as TokenType;
  }
  return createToken(type, value, lineno, colno);
};
