import type { Tokenizer } from '../types.ts';
import type { Delimiters } from '../delimiters.ts';
import { matches, advance } from '../state.ts';
import { createToken } from '../tokens.ts';
import type { TokenType } from '../token-types.ts';

export const createDelimiterTokenizer = (
  tokenType: TokenType,
  stripKey: keyof Delimiters,
  plainKey: keyof Delimiters,
  stripFlag: Record<string, boolean>,
): Tokenizer => (state) => {
  const stripTag = state.tags[stripKey];
  if (matches(state, stripTag)) {
    return {
      token: createToken(tokenType, stripTag, state.lineno, state.colno, stripFlag),
      state: advance(state, stripTag.length),
    };
  }
  const plainTag = state.tags[plainKey];
  if (!matches(state, plainTag)) { return null; }
  return {
    token: createToken(tokenType, plainTag, state.lineno, state.colno),
    state: advance(state, plainTag.length),
  };
};
