import type { Tokenizer } from '../types';
import { matches, advance } from '../state';
import { createToken } from '../tokens';
import type { TokenType } from '../token-types';

export const tokenizeBlockStart: Tokenizer = (state) => {
  if (!matches(state, state.tags.BLOCK_START)) return null;
  return {
    token: createToken(
      'block-start' as TokenType,
      state.tags.BLOCK_START,
      state.lineno,
      state.colno
    ),
    state: advance(state, state.tags.BLOCK_START.length),
  };
};

export const tokenizeBlockEnd: Tokenizer = (state) => {
  if (!matches(state, state.tags.BLOCK_END)) return null;
  return {
    token: createToken(
      'block-end' as TokenType,
      state.tags.BLOCK_END,
      state.lineno,
      state.colno
    ),
    state: advance(state, state.tags.BLOCK_END.length),
  };
};
