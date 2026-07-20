import type { Tokenizer } from '../types';
import { WHITESPACE_CHARS, DELIM_CHARS, validators } from '../constants';
import { advance } from '../state';
import { extractUntil } from '../extract';
import { createToken, createNumberToken } from '../tokens';
import type { TokenType } from '../token-types';

const { isNumericString, isBooleanString, isNullString } = validators;

export const tokenizeSymbol: Tokenizer = (state) => {
  const sym = extractUntil(state.str, state.index, WHITESPACE_CHARS + DELIM_CHARS);
  if (!sym) return null;

  let current = advance(state, sym.length);

  if (isNumericString(sym)) {
    return {
      token: createNumberToken(parseInt(sym, 10), current.lineno, current.colno, false),
      state: current,
    };
  }

  let type: TokenType = 'symbol' as TokenType;
  if (isBooleanString(sym)) type = 'boolean' as TokenType;
  else if (isNullString(sym)) type = 'none' as TokenType;

  return {
    token: createToken(type, sym, current.lineno, current.colno),
    state: current,
  };
};
