import type { LexerOptions, LexerState } from './types.ts';
import type { Token } from './token-types.ts';
import { createState, advance, getChar } from './state.ts';
import { tokenizers } from './tokenizers/index.ts';
import { createDelimiters } from './delimiters.ts';
import { WHITESPACE_CHARS } from './constants.ts';

const updateCodeState = (tokenType: string, state: LexerState): LexerState => {
  if (tokenType === 'block-start' || tokenType === 'variable-start') {
    return { ...state, inCode: true };
  }
  if (tokenType === 'block-end' || tokenType === 'variable-end') {
    return { ...state, inCode: false };
  }
  return state;
};

const processTokenizerResult = (result: { token: Token; state: LexerState }): LexerState => {
  const state = result.state;
  return updateCodeState(result.token.type, state);
};

const handleUnexpectedChar = (state: LexerState): never => {
  const char = getChar(state);
  throw new Error(`Unexpected character '${char}' at line ${state.lineno}:${state.colno}`);
};

const isWhitespace = (char: string | null): boolean =>
  char !== null && WHITESPACE_CHARS.includes(char);

const lexAll = (state: LexerState, tokens: Token[]): Token[] => {
  if (state.index >= state.str.length) { return tokens; }
  const result = tokenizers(state);
  if (result) {
    tokens.push(result.token);
    return lexAll(processTokenizerResult(result), tokens);
  }
  const char = getChar(state);
  if (char && !isWhitespace(char)) {
    handleUnexpectedChar(state);
  }
  return lexAll(advance(state), tokens);
};

export const createTokenizer = (src: string, options: LexerOptions = {}): {
  nextToken: () => Token | null;
  tags: ReturnType<typeof createDelimiters>;
  trimBlocks: boolean;
  lstripBlocks: boolean;
} => {
  const tokens = lexAll(createState(src, options), []);
  const tags = createDelimiters(options.tags);
  let cursor = 0;

  return {
    nextToken: (): Token | null => {
      if (cursor >= tokens.length) { return null; }
      const token = tokens[cursor];
      if (!token) { return null; }
      cursor += 1;
      return token;
    },
    tags,
    trimBlocks: Boolean(options.trimBlocks),
    lstripBlocks: Boolean(options.lstripBlocks),
  };
};
