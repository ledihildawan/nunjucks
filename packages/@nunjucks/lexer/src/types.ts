import type { Delimiters, DelimiterTags } from './delimiters.ts';
import type { Token } from './token-types.ts';

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

export interface LexerOptions {
  tags?: DelimiterTags;
  trimBlocks?: boolean;
  lstripBlocks?: boolean;
}

export interface TokenStep {
  token: Token;
  state: LexerState;
}

export type Tokenizer = (state: LexerState) => TokenStep | null;
