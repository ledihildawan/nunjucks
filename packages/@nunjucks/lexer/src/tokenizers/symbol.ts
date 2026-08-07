import type { Tokenizer } from '../types.ts';
import { WHITESPACE_CHARS, DELIM_CHARS, isBooleanString, isNullString } from '../constants.ts';
import { advance } from '../state.ts';
import { extractUntil } from '../extract.ts';
import { createToken } from '../tokens.ts';
import { TOKEN_BOOLEAN, TOKEN_NONE, TOKEN_SYMBOL } from '../token-types.ts';

export const tokenizeSymbol: Tokenizer = (state) => {
  const sym = extractUntil(state.str, state.index, WHITESPACE_CHARS + DELIM_CHARS);
  if (!sym) { return null; }

  const { lineno, colno } = state;
  const current = advance(state, sym.length);

  const type = isBooleanString(sym)
    ? TOKEN_BOOLEAN
    : isNullString(sym)
      ? TOKEN_NONE
      : TOKEN_SYMBOL;

  return {
    token: createToken(type, sym, lineno, colno),
    state: current,
  };
};
