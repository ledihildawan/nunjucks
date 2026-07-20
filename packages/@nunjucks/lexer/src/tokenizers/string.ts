import type { Tokenizer } from '../types';
import { getChar } from '../state';
import { advance } from '../state';
import { parseStringContent } from '../extract';
import { createToken } from '../tokens';
import type { TokenType } from '../token-types';

export const tokenizeString: Tokenizer = (state) => {
  const char = getChar(state);
  if (char !== '"' && char !== "'") return null;

  const quote = char;
  let current = advance(state);
  const content = parseStringContent(current.str, current.index, quote);
  current = advance(current, content.length + 1);

  return {
    token: createToken('string' as TokenType, content, current.lineno, current.colno),
    state: current,
  };
};
