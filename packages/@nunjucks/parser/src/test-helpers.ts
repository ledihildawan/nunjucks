import { isErr, type Result } from '@nunjucks/lib';
import type { ParserContext } from './cursor.ts';

export const asParserContext = (context: unknown): ParserContext => context as ParserContext;

export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (isErr(result)) {
    throw result.error;
  }
  return result.value;
};
