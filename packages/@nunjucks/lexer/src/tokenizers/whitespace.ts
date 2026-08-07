import type { Tokenizer } from '../types.ts';
import { WHITESPACE_CHARS } from '../constants.ts';
import { extractWhile } from '../extract.ts';
import { advance } from '../state.ts';
import { createToken } from '../tokens.ts';
import { TOKEN_WHITESPACE } from '../token-types.ts';

export const tokenizeWhitespace: Tokenizer = (state) => {
  const ws = extractWhile(state.str, state.index, WHITESPACE_CHARS);
  if (!ws) { return null; }

  const newState = advance(state, ws.length);

  return {
    token: createToken(TOKEN_WHITESPACE, ws, state.lineno, state.colno),
    state: newState,
  };
};
