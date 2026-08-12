import type { Tokenizer, LexerState } from '../types.ts';
import { getChar, matches, advance } from '../state.ts';
import { createToken } from '../tokens.ts';
import { TOKEN_DATA } from '../token-types.ts';

export const tokenizeTemplateText: Tokenizer = (state) => {
  if (state.inCode) { return null; }

  const { lineno, colno } = state;
  const scan = (current: LexerState, text: string): { current: LexerState; text: string } => {
    if (current.index >= current.str.length) { return { current, text }; }
    if (matches(current, current.tags.blockStart) || matches(current, current.tags.variableStart)) {
      return { current, text };
    }
    return scan(advance(current), text + getChar(current));
  };
  const { current, text } = scan(state, '');

  if (!text) { return null; }
  return {
    token: createToken({ type: TOKEN_DATA, value: text, lineno, colno }),
    state: current,
  };
};
