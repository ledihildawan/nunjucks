import type { Tokenizer, LexerState } from '../types.ts';
import { getChar, matches, advance, isFinished } from '../state.ts';
import { createToken } from '../tokens.ts';
import { TOKEN_COMMENT } from '../token-types.ts';

export const tokenizeComment: Tokenizer = (state) => {
  if (!matches(state, state.tags.commentStart)) { return null; }

  const initial = advance(state, state.tags.commentStart.length);
  const scan = (current: LexerState, comment: string): { current: LexerState; comment: string } => {
    if (isFinished(current)) { return { current, comment }; }
    if (matches(current, state.tags.commentEnd)) {
      return { current: advance(current, state.tags.commentEnd.length), comment: comment + state.tags.commentEnd };
    }
    return scan(advance(current), comment + getChar(current));
  };
  const { current, comment } = scan(initial, state.tags.commentStart);

  return {
    token: createToken(TOKEN_COMMENT, comment, state.lineno, state.colno),
    state: current,
  };
};
