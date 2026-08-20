import { decodeStringEscapes, parseStringContent } from '../extract.ts';
import { createUnterminatedLiteralError } from '../literal-error.ts';
import { advance, getChar } from '../state.ts';
import { TOKEN_STRING } from '../token-types.ts';
import { createToken } from '../tokens.ts';
import type { Tokenizer } from '../types.ts';

/**
 * Tokenizes a single- or double-quoted string; the value excludes the surrounding
 * quotes and has escape sequences decoded (as the original lexer's `_parseString`
 * did), and reaching EOF before the closing quote throws an unterminated-literal error.
 */
export const tokenizeString: Tokenizer = (state) => {
  const char = getChar(state);
  if (char !== '"' && char !== "'") {
    return null;
  }

  const { lineno, colno } = state;
  const quote = char;
  const afterOpen = advance(state);
  const content = parseStringContent({ source: afterOpen.source, start: afterOpen.index, quote });
  if (afterOpen.source[afterOpen.index + content.length] !== quote) {
    throw createUnterminatedLiteralError('string', state);
  }
  const current = advance(afterOpen, content.length + 1);

  return {
    token: createToken({ type: TOKEN_STRING, value: decodeStringEscapes(content), lineno, colno }),
    state: current,
  };
};
