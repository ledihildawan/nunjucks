import type { Delimiters } from '../delimiters.ts';
import { advance, matches } from '../state.ts';
import type { TokenType } from '../token-types.ts';
import { createToken } from '../tokens.ts';
import type { Tokenizer } from '../types.ts';

interface CreateDelimiterTokenizerOptions {
  tokenType: TokenType;
  stripKey: keyof Delimiters;
  plainKey: keyof Delimiters;
  stripFlag: Record<string, boolean>;
}

/**
 * Builds a tokenizer for a tag pair that prefers the strip variant (tagging the token
 * with `stripFlag`) and falls back to the plain delimiter without strip flags.
 */
export const createDelimiterTokenizer =
  ({ tokenType, stripKey, plainKey, stripFlag }: CreateDelimiterTokenizerOptions): Tokenizer =>
  (state) => {
    const stripTag = state.tags[stripKey];
    if (matches(state, stripTag)) {
      return {
        token: createToken({
          type: tokenType,
          value: stripTag,
          lineno: state.lineno,
          colno: state.colno,
          strip: stripFlag,
        }),
        state: advance(state, stripTag.length),
      };
    }
    const plainTag = state.tags[plainKey];
    if (!matches(state, plainTag)) {
      return null;
    }
    return {
      token: createToken({
        type: tokenType,
        value: plainTag,
        lineno: state.lineno,
        colno: state.colno,
      }),
      state: advance(state, plainTag.length),
    };
  };
