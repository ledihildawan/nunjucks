import type { Delimiters, DelimiterTags } from './delimiters.ts';
import type { Token } from './token-types.ts';

/**
 * Immutable scan state threaded through every tokenizer: cursor position with
 * line/column tracking, the resolved delimiter set, and whitespace-trim flags.
 */
export interface LexerState {
  source: string;
  index: number;
  lineno: number;
  colno: number;
  inCode: boolean;
  tags: Delimiters;
  trimBlocks: boolean;
  lstripBlocks: boolean;
}

/** Options accepted by `createTokenizer` and `createState` for tags and trim behavior. */
export interface LexerOptions {
  tags?: DelimiterTags;
  trimBlocks?: boolean;
  lstripBlocks?: boolean;
}

/** The result of one successful tokenizer step: the emitted token and the next state. */
export interface TokenStep {
  token: Token;
  state: LexerState;
}

/**
 * Attempts to match at the current cursor, returning the token plus the advanced state
 * or `null` to decline without consuming input.
 */
export type Tokenizer = (state: LexerState) => TokenStep | null;
