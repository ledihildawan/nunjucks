import type { Tokenizer } from '../types.ts';
import { getChar, matches, advance, isFinished } from '../state.ts';
import { createToken } from '../tokens.ts';
import type { TokenType } from '../token-types.ts';

export const tokenizeComment: Tokenizer = (state) => {
  if (!matches(state, state.tags.COMMENT_START)) { return null; }

  let current = advance(state, state.tags.COMMENT_START.length);
  let comment = state.tags.COMMENT_START;

  while (!isFinished(current)) {
    const char = getChar(current);

    if (matches(current, state.tags.COMMENT_END)) {
      comment += state.tags.COMMENT_END;
      current = advance(current, state.tags.COMMENT_END.length);
      break;
    }

    comment += char;
    current = advance(current);
  }

  return {
    token: createToken('comment' as TokenType, comment, state.lineno, state.colno),
    state: current,
  };
};
