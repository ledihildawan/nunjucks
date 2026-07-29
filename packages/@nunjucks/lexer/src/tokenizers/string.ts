import type { Tokenizer } from '../types.ts';
import { getChar } from '../state.ts';
import { advance } from '../state.ts';
import { parseStringContent } from '../extract.ts';
import { createToken } from '../tokens.ts';
import type { TokenType } from '../token-types.ts';

export const tokenizeString: Tokenizer = (state) => {
  const char = getChar(state);
  if (char !== '"' && char !== "'") { return null; }

  const { lineno, colno } = state;
  const quote = char;
  const afterOpen = advance(state);
  const content = parseStringContent(afterOpen.str, afterOpen.index, quote);
  const current = advance(afterOpen, content.length + 1);

  return {
    token: createToken('string' as TokenType, content, lineno, colno),
    state: current,
  };
};
