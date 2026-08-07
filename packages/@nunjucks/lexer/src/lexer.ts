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

function* lexGenerator(src: string, options: LexerOptions = {}): Generator<Token, void, unknown> {
  let state = createState(src, options);

  while (state.index < state.str.length) {
    const result = tokenizers(state);

    if (result) {
      yield result.token;
      state = processTokenizerResult(result);
    } else {
      const char = getChar(state);
      if (char && !isWhitespace(char)) {
        handleUnexpectedChar(state);
      }
      state = advance(state);
    }
  }
}

export const createTokenizer = (src: string, options: LexerOptions = {}): {
  nextToken: () => Token | null;
  tags: ReturnType<typeof createDelimiters>;
  trimBlocks: boolean;
  lstripBlocks: boolean;
} => {
  const generator = lexGenerator(src, options);
  const tags = createDelimiters(options.tags);

  return {
    nextToken: (): Token | null => {
      const result = generator.next();
      if (result.done) { return null; }
      return result.value;
    },
    tags,
    trimBlocks: Boolean(options.trimBlocks),
    lstripBlocks: Boolean(options.lstripBlocks),
  };
};
