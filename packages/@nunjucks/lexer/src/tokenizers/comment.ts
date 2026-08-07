import type { Tokenizer } from '../types.ts';
import { getChar, matches, advance, isFinished } from '../state.ts';
import { createToken } from '../tokens.ts';
import { TOKEN_COMMENT } from '../token-types.ts';

export const tokenizeComment: Tokenizer = (state) => {
  if (!matches(state, state.tags.commentStart)) { return null; }

  let current = advance(state, state.tags.commentStart.length);
  let comment = state.tags.commentStart;

  while (!isFinished(current)) {
    const char = getChar(current);

    if (matches(current, state.tags.commentEnd)) {
      comment += state.tags.commentEnd;
      current = advance(current, state.tags.commentEnd.length);
      break;
    }

    comment += char;
    current = advance(current);
  }

  return {
    token: createToken(TOKEN_COMMENT, comment, state.lineno, state.colno),
    state: current,
  };
};
