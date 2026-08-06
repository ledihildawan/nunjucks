import type { Tokenizer } from './types.ts';

export const firstMatch = (...tokenizers: Tokenizer[]): Tokenizer => (state) => {
  for (const tokenizer of tokenizers) {
    const result = tokenizer(state);
    if (result) { return result; }
  }
  return null;
};
