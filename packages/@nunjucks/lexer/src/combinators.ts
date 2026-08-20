import type { Tokenizer } from './types.ts';

/**
 * Combines tokenizers into one that delegates to the first accepting tokenizer,
 * returning `null` only when every candidate declines the current state.
 */
export const firstMatch =
  (...tokenizers: Tokenizer[]): Tokenizer =>
  (state) => {
    for (const tokenize of tokenizers) {
      const result = tokenize(state);
      if (result) {
        return result;
      }
    }
    return null;
  };
