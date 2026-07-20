import type { Tokenizer } from '../types';
import { matches, advance } from '../state';
import { createToken } from '../tokens';
import type { TokenType } from '../token-types';

export const tokenizeVariableStart: Tokenizer = (state) => {
  if (!matches(state, state.tags.VARIABLE_START)) return null;
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
  if (!matches(state, state.tags.VARIABLE_END)) return null;
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
