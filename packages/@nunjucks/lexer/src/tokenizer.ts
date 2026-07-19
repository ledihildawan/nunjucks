import type { Token, TokenValue, TokenType } from './token-types';

export interface LexerOptions {
  tags?: {
    blockStart?: string;
    blockEnd?: string;
    variableStart?: string;
    variableEnd?: string;
    commentStart?: string;
    commentEnd?: string;
  };
  trimBlocks?: boolean;
  lstripBlocks?: boolean;
}

export interface Lexer {
  readonly str: string;
  readonly index: number;
  readonly len: number;
  readonly lineno: number;
  readonly colno: number;
  readonly in_code: boolean;
  readonly tags: {
    BLOCK_START: string;
    BLOCK_END: string;
    VARIABLE_START: string;
    VARIABLE_END: string;
    COMMENT_START: string;
    COMMENT_END: string;
  };
  readonly trimBlocks: boolean;
  readonly lstripBlocks: boolean;
  current(): string;
  previous(): string;
  currentStr(): string;
  isFinished(): boolean;
  forward(): void;
  back(): void;
  forwardN(n: number): void;
  backN(n: number): void;
  peek(): string;
  nextToken(): Token | null;
}

export function createTokenizer(str: string, opts?: LexerOptions): Lexer {
  return null as unknown as Lexer;
}

export function lex(str: string, opts?: LexerOptions): Generator<Token, void, unknown> {
  return null as unknown as Generator<Token, void, unknown>;
}

export function createToken(type: TokenType, value: TokenValue, lineno: number, colno: number): Token {
  return { type, value, lineno, colno };
}
