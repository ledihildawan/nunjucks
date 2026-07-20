import type { LexerOptions } from './types';
import type { Token } from './token-types';
import { createState, advance } from './state';
import { tokenizers } from './tokenizers';

export function* lex(src: string, opts: LexerOptions = {}): Generator<Token, void, unknown> {
  let state = createState(src, opts);

  while (state.index < state.str.length) {
    const result = tokenizers(state);

    if (!result) {
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

export function createTokenizer(src: string, opts: LexerOptions = {}) {
  const generator = lex(src, opts);

  return {
    nextToken: (): Token | null => {
      const result = generator.next();
      if (result.done) return null;
      return result.value;
    },
  };
}
