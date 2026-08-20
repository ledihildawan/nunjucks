import { createUnterminatedLiteralError } from '../literal-error.ts';
import { advance, getChar, isFinished, matches } from '../state.ts';
import { TOKEN_COMMENT } from '../token-types.ts';
import { createToken } from '../tokens.ts';
import type { Tokenizer } from '../types.ts';

/**
 * Tokenizes a `{# ... #}` comment, reproducing the full delimiter text in the token
 * value; `{#-` / `-#}` style strip markers flag `stripLeft`/`stripRight` canonically,
 * and reaching EOF before the close throws an unterminated-literal error.
 */
export const tokenizeComment: Tokenizer = (state) => {
  if (!matches(state, state.tags.commentStart)) {
    return null;
  }

  const initial = advance(state, state.tags.commentStart.length);
  // WHY: strip markers hug the delimiters — a `-` directly after commentStart or
  // directly before commentEnd — so the parser can read canonical flags instead of
  // re-deriving them by index arithmetic.
  const stripLeft = getChar(initial) === '-';
  // WHY: while loop instead of per-character recursion — a large comment body overflowed
  // the native stack. Loop exemption: lexer/tokenizer engine.
  let current = initial;
  let comment = state.tags.commentStart;
  while (!isFinished(current)) {
    if (matches(current, state.tags.commentEnd)) {
      const stripRight = state.source[current.index - 1] === '-';
      return {
        token: createToken({
          type: TOKEN_COMMENT,
          value: comment + state.tags.commentEnd,
          lineno: state.lineno,
          colno: state.colno,
          strip: { stripLeft, stripRight },
        }),
        state: advance(current, state.tags.commentEnd.length),
      };
    }
    comment += getChar(current);
    current = advance(current);
  }
  throw createUnterminatedLiteralError('comment', state);
};
