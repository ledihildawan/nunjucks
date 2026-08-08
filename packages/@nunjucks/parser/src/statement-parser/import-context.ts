import type { TemplateError } from '@nunjucks/log';
import { peekToken, skipSymbol, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/shared';

export const parseWithContext = (parserContext: ParserContext): Result<boolean | null, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;

  const withContext: boolean | null = skipSymbol(parserContext, 'with')
    ? true
    : skipSymbol(parserContext, 'without')
      ? false
      : null;

  if (withContext !== null && !skipSymbol(parserContext, 'context')) {
    return fail(parserContext, 'parseFrom: expected context after with/without',
      tok.lineno,
      tok.colno);
  }

  return ok(withContext);
};
