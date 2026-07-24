import type { Tokenizer } from '../types.ts';
import { WHITESPACE_CHARS } from '../constants.ts';
import { extractWhile } from '../extract.ts';
import { advance } from '../state.ts';
import { createToken } from '../tokens.ts';
import type { TokenType } from '../token-types.ts';

export const tokenizeWhitespace: Tokenizer = (state) => {
  const ws = extractWhile(state.str, state.index, WHITESPACE_CHARS);
  if (!ws) { return null; }

  const newState = advance(state, ws.length);

  return {
    token: createToken('whitespace' as TokenType, ws, state.lineno, state.colno),
    state: newState,
  };
};
