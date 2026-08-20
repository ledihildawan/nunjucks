import { isBooleanString, isNullString, SYMBOL_TERMINATOR_SET } from '../constants.ts';
import { extractUntil } from '../extract.ts';
import { advance } from '../state.ts';
import { TOKEN_BOOLEAN, TOKEN_NONE, TOKEN_SYMBOL } from '../token-types.ts';
import { createToken } from '../tokens.ts';
import type { Tokenizer } from '../types.ts';

/**
 * Tokenizes identifiers and keyword literals, promoting `true`/`false` to
 * `TOKEN_BOOLEAN` and `none`/`null` to `TOKEN_NONE`; everything else stays a symbol.
 */
export const tokenizeSymbol: Tokenizer = (state) => {
  const sym = extractUntil({
    source: state.source,
    start: state.index,
    terminators: SYMBOL_TERMINATOR_SET,
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
