import type { ParserContext, TokenStream } from './cursor.ts';

export const asTokenStream = <T>(mock: T): TokenStream => mock as TokenStream;

export const asParserContext = <T>(mock: T): ParserContext => mock as ParserContext;