import type { Token, TokenType, TokenValueByType } from './token-types.ts';
import {
  TOKEN_BLOCK_END,
  TOKEN_FLOAT,
  TOKEN_INT,
  TOKEN_SYMBOL,
  TOKEN_VARIABLE_END,
} from './token-types.ts';

interface CreateTokenOptions {
  type: TokenType;
  value: TokenValueByType[TokenType];
  lineno: number;
  colno: number;
  strip?: { stripLeft?: boolean; stripRight?: boolean };
}

/**
 * Creates a `Token` at the given position, setting `stripLeft`/`stripRight` only when
 * the corresponding strip flag is truthy so absent flags stay off the token.
 */
export const createToken = ({ type, value, lineno, colno, strip }: CreateTokenOptions): Token =>
  ({
    type,
    value,
    lineno,
    colno,
    ...(strip?.stripLeft && { stripLeft: true }),
    ...(strip?.stripRight && { stripRight: true }),
  }) as Token;

interface CreateNumberTokenOptions {
  value: number;
  lineno: number;
  colno: number;
  hasDecimal: boolean;
}

/**
 * Creates a numeric token typed as `TOKEN_FLOAT` when `hasDecimal` is set and
 * `TOKEN_INT` otherwise.
 */
export const createNumberToken = ({
  value,
  lineno,
  colno,
  hasDecimal,
}: CreateNumberTokenOptions): Token => {
  const type: TokenType = hasDecimal ? TOKEN_FLOAT : TOKEN_INT;
  return createToken({ type, value, lineno, colno });
};

/** Narrows a token to one whose `value` is a string. */
export const isStringToken = (tok: Token): tok is Token & { value: string } =>
  typeof tok.value === 'string';

/** Narrows a token to a `symbol` token carrying a string value. */
export const isSymbolToken = (tok: Token): tok is Token & { type: 'symbol' } =>
  tok.type === TOKEN_SYMBOL && isStringToken(tok);

/** Narrows a token to a `block-end` token carrying a string value. */
export const isBlockEndToken = (tok: Token): tok is Token & { type: 'block-end' } =>
  tok.type === TOKEN_BLOCK_END && isStringToken(tok);

/** Narrows a token to a `variable-end` token carrying a string value. */
export const isVariableEndToken = (tok: Token): tok is Token & { type: 'variable-end' } =>
  tok.type === TOKEN_VARIABLE_END && isStringToken(tok);
