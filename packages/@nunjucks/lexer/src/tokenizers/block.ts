import type { Tokenizer } from '../types.ts';
import { matches, advance } from '../state.ts';
import { createToken } from '../tokens.ts';
import type { TokenType } from '../token-types.ts';

export const tokenizeBlockStart: Tokenizer = (state) => {
  if (matches(state, state.tags.STRIP_BLOCK_START)) {
    return {
      token: createToken(
        'block-start' as TokenType,
        state.tags.STRIP_BLOCK_START,
        state.lineno,
        state.colno,
        { stripLeft: true }
      ),
      state: advance(state, state.tags.STRIP_BLOCK_START.length),
    };
  }
  if (!matches(state, state.tags.BLOCK_START)) { return null; }
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
  if (matches(state, state.tags.STRIP_BLOCK_END)) {
    return {
      token: createToken(
        'block-end' as TokenType,
        state.tags.STRIP_BLOCK_END,
        state.lineno,
        state.colno,
        { stripRight: true }
      ),
      state: advance(state, state.tags.STRIP_BLOCK_END.length),
    };
  }
  if (!matches(state, state.tags.BLOCK_END)) { return null; }
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
