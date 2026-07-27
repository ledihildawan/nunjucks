import type { LexerOptions } from './types.ts';
import type { Token } from './token-types.ts';
import { createState, advance, getChar } from './state.ts';
import { tokenizers } from './tokenizers/index.ts';
import { createDelimiters } from './delimiters.ts';
import { WHITESPACE_CHARS } from './constants.ts';

function* lexGenerator(src: string, opts: LexerOptions = {}): Generator<Token, void, unknown> {
  let state = createState(src, opts);

  while (state.index < state.str.length) {
    const result = tokenizers(state);

    if (result) {
      yield result.token;
      const { state: newState } = result;
      state = newState;

      const tokenType = result.token.type as string;
      if (tokenType === 'block-start' || tokenType === 'variable-start') {
        state = { ...state, inCode: true };
      } else if (tokenType === 'block-end' || tokenType === 'variable-end') {
        state = { ...state, inCode: false };
      }
    } else {
      const char = getChar(state);
      if (char && !WHITESPACE_CHARS.includes(char)) {
        throw new Error(`Unexpected character '${char}' at line ${state.lineno}:${state.colno}`);
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
