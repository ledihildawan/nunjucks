import type { LexerOptions, LexerState } from './types.ts';
import type { Token } from './token-types.ts';
import { createState, advance, getChar } from './state.ts';
import { tokenizers } from './tokenizers/index.ts';
import { createDelimiters } from './delimiters.ts';
import { WHITESPACE_CHARS } from './constants.ts';
import { createLog } from '@nunjucks/error-formatter';
import { MATCH_ANY_RE } from '@nunjucks/lib';

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
  throw createLog('error', {
    def: {
      name: 'UNEXPECTED_CHAR',
      message: () => `Unexpected character '${char}' at line ${state.lineno}:${state.colno}`,
      pattern: MATCH_ANY_RE,
    },
    params: { char },
    subject: char,
    context: { lineno: state.lineno, colno: state.colno, phase: 'parse', lineBase: 'zero' },
  });
};

const isWhitespace = (char: string | null): boolean =>
  char !== null && WHITESPACE_CHARS.includes(char);

// WHY: recursive generator (no for/while loop) that lazily yields tokens one at a time — satisfies the guide's "Lazy Evaluation & Streaming (Generator)" recommendation for processing potentially large template sources with low memory footprint. Each call yields at most one token, then delegates the remainder via yield*.
const lexGenerator = function* (state: LexerState): Generator<Token, void, unknown> {
  if (state.index >= state.str.length) { return; }
  const result = tokenizers(state);
  if (result) {
    yield result.token;
    yield* lexGenerator(processTokenizerResult(result));
    return;
  }
  const char = getChar(state);
  if (char && !isWhitespace(char)) {
    handleUnexpectedChar(state);
  }
  yield* lexGenerator(advance(state));
};

export const createTokenizer = (src: string, options: LexerOptions = {}): {
  nextToken: () => Token | null;
  tags: ReturnType<typeof createDelimiters>;
  trimBlocks: boolean;
  lstripBlocks: boolean;
} => {
  const generator = lexGenerator(createState(src, options));
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
