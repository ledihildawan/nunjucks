import type { Tokenizer } from '../types.ts';
import { getChar, matches, advance } from '../state.ts';
import { createToken } from '../tokens.ts';
import { TOKEN_DATA } from '../token-types.ts';

export const tokenizeTemplateText: Tokenizer = (state) => {
  if (state.inCode) { return null; }

  let text = '';
  const { lineno, colno } = state;
  let current = state;

  while (current.index < current.str.length) {
    const char = getChar(current);

    if (
      matches(current, current.tags.blockStart) ||
      matches(current, current.tags.variableStart)
    ) {
      break;
    }

    text += char;
    current = advance(current);
  }

  if (!text) { return null; }
  return {
    token: createToken(TOKEN_DATA, text, lineno, colno),
    state: current,
  };
};
