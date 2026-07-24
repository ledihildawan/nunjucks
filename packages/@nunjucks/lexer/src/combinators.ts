import type { Tokenizer } from './types.ts';

export const or = (...tokenizers: Tokenizer[]): Tokenizer => (state) => {
  for (const tokenizer of tokenizers) {
    const result = tokenizer(state);
    if (result) { return result; }
  }
  return null;
};
