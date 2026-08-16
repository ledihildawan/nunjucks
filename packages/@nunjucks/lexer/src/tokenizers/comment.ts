import { createUnterminatedLiteralError } from '../literal-error.ts';
import { advance, getChar, isFinished, matches } from '../state.ts';
import { TOKEN_COMMENT } from '../token-types.ts';
import { createToken } from '../tokens.ts';
import type { LexerState, Tokenizer } from '../types.ts';

export const tokenizeComment: Tokenizer = (state) => {
  if (!matches(state, state.tags.commentStart)) {
    return null;
  }

  const initial = advance(state, state.tags.commentStart.length);
  const scan = (current: LexerState, comment: string): { current: LexerState; comment: string } => {
    if (isFinished(current)) {
      throw createUnterminatedLiteralError('comment', state);
    }
    if (matches(current, state.tags.commentEnd)) {
      return {
        current: advance(current, state.tags.commentEnd.length),
        comment: comment + state.tags.commentEnd,
      };
    }
    return scan(advance(current), comment + getChar(current));
  };
  const { current: finalState, comment: commentValue } = scan(initial, state.tags.commentStart);

  return {
    token: createToken({
      type: TOKEN_COMMENT,
      value: commentValue,
      lineno: state.lineno,
      colno: state.colno,
    }),
    state: finalState,
  };
};
