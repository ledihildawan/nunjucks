import type { TemplateError } from '@nunjucks/error-formatter';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { ParserContext } from '../cursor.ts';
import { fail, peekToken, skipSymbol } from '../cursor.ts';

/**
 * Consumes the optional `with context` / `without context` suffix on
 * import statements, failing when `with`/`without` is not followed by
 * `context`; returns `null` when the suffix is absent.
 */
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
