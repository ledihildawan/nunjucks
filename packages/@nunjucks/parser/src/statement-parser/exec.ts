import type { TemplateError } from '@nunjucks/error-formatter';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { execNode } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { fail, nextToken, peekToken, skipSymbol } from '../cursor.ts';
import { parseExpression } from '../expression-parser/index.ts';

export const parseExec = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) {
    return tagR;
  }
  const tag = tagR.value;
  if (!skipSymbol(parserContext, 'exec')) {
    return fail(parserContext, 'expected exec', { lineno: tag.lineno, colno: tag.colno });
  }

  const exprR = parseExpression(parserContext);
  if (isErr(exprR)) {
    return exprR;
  }

  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) {
    return consumedR;
  }

  return ok(execNode(loc(tag), exprR.value));
};
