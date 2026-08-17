import { WHITESPACE_CHARS } from '../constants.ts';
import { extractWhile } from '../extract.ts';
import { advance } from '../state.ts';
import { TOKEN_WHITESPACE } from '../token-types.ts';
import { createToken } from '../tokens.ts';
import type { Tokenizer } from '../types.ts';

/** Consumes a run of whitespace characters as a single `whitespace` token. */
export const tokenizeWhitespace: Tokenizer = (state) => {
  const ws = extractWhile({ source: state.source, start: state.index, chars: WHITESPACE_CHARS });
  if (!ws) {
    return null;
  }

  const newState = advance(state, ws.length);

  return {
    token: createToken({
      type: TOKEN_WHITESPACE,
      value: ws,
      lineno: state.lineno,
      colno: state.colno,
    }),
    state: newState,
  };
};
