import type { Tokenizer } from '../types.ts';
import { WHITESPACE_CHARS, DELIM_CHARS, validators } from '../constants.ts';
import { advance } from '../state.ts';
import { extractUntil } from '../extract.ts';
import { createToken, createNumberToken } from '../tokens.ts';
import type { TokenType } from '../token-types.ts';

const { isNumericString, isBooleanString, isNullString } = validators;

export const tokenizeSymbol: Tokenizer = (state) => {
  const sym = extractUntil(state.str, state.index, WHITESPACE_CHARS + DELIM_CHARS);
  if (!sym) { return null; }

  const { lineno, colno } = state;
  const current = advance(state, sym.length);

  if (isNumericString(sym)) {
    return {
      token: createNumberToken(Number.parseInt(sym, 10), current.lineno, colno, false),
      state: current,
    };
  }

  let type: TokenType = 'symbol' as TokenType;
  if (isBooleanString(sym)) { type = 'boolean' as TokenType; }
  else if (isNullString(sym)) { type = 'none' as TokenType; }

  return {
    token: createToken(type, sym, lineno, colno),
    state: current,
  };
};
