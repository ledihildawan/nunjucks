import { parseStringContent } from '../extract.ts';
import { advance, getChar } from '../state.ts';
import { TOKEN_STRING } from '../token-types.ts';
import { createToken } from '../tokens.ts';
import type { Tokenizer } from '../types.ts';

export const tokenizeString: Tokenizer = (state) => {
  const char = getChar(state);
  if (char !== '"' && char !== "'") {
    return null;
  }

  const { lineno, colno } = state;
  const quote = char;
  const afterOpen = advance(state);
  const content = parseStringContent({ source: afterOpen.source, start: afterOpen.index, quote });
  const current = advance(afterOpen, content.length + 1);

  return {
    token: createToken({ type: TOKEN_STRING, value: content, lineno, colno }),
    state: current,
  };
};
