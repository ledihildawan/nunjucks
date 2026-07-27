import type { LexerOptions } from './types.ts';
import type { Token } from './token-types.ts';
import { createState, advance, getChar } from './state.ts';
import { tokenizers } from './tokenizers/index.ts';
import { createDelimiters } from './delimiters.ts';
import { WHITESPACE_CHARS } from './constants.ts';

const updateCodeState = (tokenType: string, state: ReturnType<typeof createState>): ReturnType<typeof createState> => {
  if (tokenType === 'block-start' || tokenType === 'variable-start') {
    return { ...state, inCode: true };
  }
  if (tokenType === 'block-end' || tokenType === 'variable-end') {
    return { ...state, inCode: false };
  }
  return state;
};

const processTokenizerResult = (result: { token: Token; state: ReturnType<typeof createState> }): ReturnType<typeof createState> => {
  const state = result.state;
  const tokenType = result.token.type as string;
  return updateCodeState(tokenType, state);
};

const handleUnexpectedChar = (state: ReturnType<typeof createState>): never => {
  const char = getChar(state);
  throw new Error(`Unexpected character '${char}' at line ${state.lineno}:${state.colno}`);
};

const isWhitespace = (char: string | null): boolean =>
  char !== null && WHITESPACE_CHARS.includes(char);

function* lexGenerator(src: string, opts: LexerOptions = {}): Generator<Token, void, unknown> {
  let state = createState(src, opts);

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

export function createTokenizer(src: string, opts: LexerOptions = {}) {
  const generator = lexGenerator(src, opts);
  const tags = createDelimiters(opts.tags);

  return {
    nextToken: (): Token | null => {
      const result = generator.next();
      if (result.done) { return null; }
      return result.value;
    },
    tags,
    trimBlocks: Boolean(opts.trimBlocks),
    lstripBlocks: Boolean(opts.lstripBlocks),
  };
}
