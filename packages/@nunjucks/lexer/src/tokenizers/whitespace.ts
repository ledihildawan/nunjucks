import type { Tokenizer } from '../types';
import { WHITESPACE_CHARS } from '../constants';
import { extractWhile } from '../extract';
import { advance } from '../state';
import { createToken } from '../tokens';
import type { TokenType } from '../token-types';

export const tokenizeWhitespace: Tokenizer = (state) => {
  const ws = extractWhile(state.str, state.index, WHITESPACE_CHARS);
  if (!ws) return null;

  const newState = advance(state, ws.length);

  return {
    token: createToken('whitespace' as TokenType, ws, state.lineno, state.colno),
    state: newState,
  };
};
