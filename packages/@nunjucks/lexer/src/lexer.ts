import type { LexerOptions } from './types';
import type { Token } from './token-types';
import { createState, advance, getChar } from './state';
import { tokenizers } from './tokenizers';
import { createDelimiters } from './delimiters';
import { WHITESPACE_CHARS } from './constants';

function* lexGenerator(src: string, opts: LexerOptions = {}): Generator<Token, void, unknown> {
  let state = createState(src, opts);

  while (state.index < state.str.length) {
    const result = tokenizers(state);

    if (!result) {
      const char = getChar(state);
      if (char && !WHITESPACE_CHARS.includes(char)) {
        throw new Error(`Unexpected character '${char}' at line ${state.lineno}:${state.colno}`);
      }
      state = advance(state);
      continue;
    }

    yield result.token;
    state = result.state;

    const tokenType = result.token.type as string;
    if (tokenType === 'block-start' || tokenType === 'variable-start') {
      state = { ...state, inCode: true };
    } else if (tokenType === 'block-end' || tokenType === 'variable-end') {
      state = { ...state, inCode: false };
    }
  }
}

export function lex(src: string, opts: LexerOptions = {}) {
  const generator = lexGenerator(src, opts);
  const tags = createDelimiters(opts.tags);

  return {
    nextToken: (): Token | null => {
      const result = generator.next();
      if (result.done) return null;
      return result.value;
    },
    tags,
    trimBlocks: Boolean(opts.trimBlocks),
    lstripBlocks: Boolean(opts.lstripBlocks),
  };
}

export { lex as createTokenizer };
