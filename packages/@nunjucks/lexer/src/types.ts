import type { Token, TokenType, TokenValue } from './token-types';
import type { Delimiters, DelimiterTags } from './delimiters';

export interface LexerState {
  str: string;
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

export interface TokenizeResult {
  token: Token;
  state: LexerState;
}

export type Tokenizer = (state: LexerState) => TokenizeResult | null;
