import type { TemplateError } from '@nunjucks/error-formatter';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { ParserContext } from '../cursor.ts';
import { fail, peekToken, skipSymbol } from '../cursor.ts';

export const parseWithContext = (
  parserContext: ParserContext
): Result<boolean | null, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;

  const withContext: boolean | null = skipSymbol(parserContext, 'with')
    ? true
    : skipSymbol(parserContext, 'without')
      ? false
      : null;

  if (withContext !== null && !skipSymbol(parserContext, 'context')) {
    return fail(parserContext, {
      message: 'parseFrom: expected context after with/without',
      lineno: tok.lineno,
      colno: tok.colno,
    });
  }

  return ok(withContext);
};
