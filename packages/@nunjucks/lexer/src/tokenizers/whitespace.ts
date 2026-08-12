import type { Tokenizer } from '../types.ts';
import { WHITESPACE_CHARS } from '../constants.ts';
import { extractWhile } from '../extract.ts';
import { advance } from '../state.ts';
import { createToken } from '../tokens.ts';
import { TOKEN_WHITESPACE } from '../token-types.ts';

export const tokenizeWhitespace: Tokenizer = (state) => {
  const ws = extractWhile({ str: state.str, start: state.index, chars: WHITESPACE_CHARS });
  if (!ws) { return null; }

  const newState = advance(state, ws.length);

  return {
    token: createToken({ type: TOKEN_WHITESPACE, value: ws, lineno: state.lineno, colno: state.colno }),
    state: newState,
  };
};
