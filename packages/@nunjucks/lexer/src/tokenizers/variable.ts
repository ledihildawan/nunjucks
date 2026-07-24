import type { Tokenizer } from '../types.ts';
import { matches, advance } from '../state.ts';
import { createToken } from '../tokens.ts';
import type { TokenType } from '../token-types.ts';

export const tokenizeVariableStart: Tokenizer = (state) => {
  if (matches(state, state.tags.STRIP_VARIABLE_START)) {
    return {
      token: createToken(
        'variable-start' as TokenType,
        state.tags.STRIP_VARIABLE_START,
        state.lineno,
        state.colno,
        { stripLeft: true }
      ),
      state: advance(state, state.tags.STRIP_VARIABLE_START.length),
    };
  }
  if (!matches(state, state.tags.VARIABLE_START)) { return null; }
  return {
    token: createToken(
      'variable-start' as TokenType,
      state.tags.VARIABLE_START,
      state.lineno,
      state.colno
    ),
    state: advance(state, state.tags.VARIABLE_START.length),
  };
};

export const tokenizeVariableEnd: Tokenizer = (state) => {
  if (matches(state, state.tags.STRIP_VARIABLE_END)) {
    return {
      token: createToken(
        'variable-end' as TokenType,
        state.tags.STRIP_VARIABLE_END,
        state.lineno,
        state.colno,
        { stripRight: true }
      ),
      state: advance(state, state.tags.STRIP_VARIABLE_END.length),
    };
  }
  if (!matches(state, state.tags.VARIABLE_END)) { return null; }
  return {
    token: createToken(
      'variable-end' as TokenType,
      state.tags.VARIABLE_END,
      state.lineno,
      state.colno
    ),
    state: advance(state, state.tags.VARIABLE_END.length),
  };
};
