import { advance, getChar, matches } from '../state.ts';
import { TOKEN_DATA } from '../token-types.ts';
import { createToken } from '../tokens.ts';
import type { LexerState, Tokenizer } from '../types.ts';

export const tokenizeTemplateText: Tokenizer = (state) => {
  if (state.inCode) {
    return null;
  }

  const { lineno, colno } = state;
  const scan = (current: LexerState, text: string): { current: LexerState; text: string } => {
    if (current.index >= current.source.length) {
      return { current, text };
    }
    if (
      matches(current, current.tags.blockStart) ||
      matches(current, current.tags.variableStart) ||
      matches(current, current.tags.commentStart)
    ) {
      return { current, text };
    }
    return scan(advance(current), text + getChar(current));
  };
  const { current, text } = scan(state, '');

  if (!text) {
    return null;
  }
  return {
    token: createToken({ type: TOKEN_DATA, value: text, lineno, colno }),
    state: current,
  };
};
