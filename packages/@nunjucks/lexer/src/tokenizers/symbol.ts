import { DELIM_CHARS, isBooleanString, isNullString, WHITESPACE_CHARS } from '../constants.ts';
import { extractUntil } from '../extract.ts';
import { advance } from '../state.ts';
import { TOKEN_BOOLEAN, TOKEN_NONE, TOKEN_SYMBOL } from '../token-types.ts';
import { createToken } from '../tokens.ts';
import type { Tokenizer } from '../types.ts';

export const tokenizeSymbol: Tokenizer = (state) => {
  const sym = extractUntil({
    source: state.source,
    start: state.index,
    chars: WHITESPACE_CHARS + DELIM_CHARS,
  });
  if (!sym) {
    return null;
  }

  const { lineno, colno } = state;
  const current = advance(state, sym.length);

  const type = isBooleanString(sym) ? TOKEN_BOOLEAN : isNullString(sym) ? TOKEN_NONE : TOKEN_SYMBOL;

  return {
    token: createToken({ type, value: sym, lineno, colno }),
    state: current,
  };
};
