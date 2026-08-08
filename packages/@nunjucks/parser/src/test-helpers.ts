import { isErr, type Result } from '@nunjucks/shared';
import type { ParserContext, TokenStream } from './cursor.ts';

export const asTokenStream = <T>(mock: T): TokenStream => mock as TokenStream;

export const asParserContext = <T>(mock: T): ParserContext => mock as ParserContext;

export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (isErr(result)) {
    throw result.error;
  }
  return result.value;
};
