import type { Tokenizer } from '../types';
import { getChar, matches, advance } from '../state';
import { createToken } from '../tokens';
import type { TokenType } from '../token-types';

export const tokenizeTemplateText: Tokenizer = (state) => {
  if (state.inCode) return null;

  let text = '';
  const { lineno, colno } = state;
  let current = state;

  while (current.index < current.str.length) {
    const char = getChar(current);

    if (
      matches(current, current.tags.BLOCK_START) ||
      matches(current, current.tags.VARIABLE_START)
    ) {
      break;
    }

    text += char;
    current = advance(current);
  }

  if (!text) return null;
  return {
    token: createToken('data' as TokenType, text, lineno, colno),
    state: current,
  };
};
