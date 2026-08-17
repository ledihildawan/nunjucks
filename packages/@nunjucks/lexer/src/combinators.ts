import type { Tokenizer } from './types.ts';

/**
 * Combines tokenizers into one that delegates to the first accepting tokenizer,
 * returning `null` only when every candidate declines the current state.
 */
export const firstMatch =
  (...tokenizers: Tokenizer[]): Tokenizer =>
  (state) => {
    const tryAt = (index: number): ReturnType<Tokenizer> => {
      if (index >= tokenizers.length) {
        return null;
      }
      const result = tokenizers[index]?.(state) ?? null;
      if (result) {
        return result;
      }
      return tryAt(index + 1);
    };
    return tryAt(0);
  };
