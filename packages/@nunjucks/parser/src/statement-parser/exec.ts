import type { TemplateError } from '@nunjucks/error-formatter';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { execNode } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { advanceAfterBlockEnd, fail, peekToken, skipSymbol } from '../cursor.ts';
import { parseExpression } from '../expression-parser/index.ts';

export const parseExec = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) {
    return tagR;
  }
  const tag = tagR.value;
  if (!skipSymbol(parserContext, 'exec')) {
    return fail(parserContext, { message: 'expected exec', lineno: tag.lineno, colno: tag.colno });
  }

  const exprR = parseExpression(parserContext);
  if (isErr(exprR)) {
    return exprR;
  }

  // WHY: advanceAfterBlockEnd validates the block-end token (a trailing garbage token
  // like `{% exec 1 2 %}` must fail HERE with a precise message, not later as a
  // misleading top-level error) and honors `-%}` whitespace control like every
  // sibling statement parser.
  const blockEndR = advanceAfterBlockEnd(parserContext, 'exec');
  if (isErr(blockEndR)) {
    return blockEndR;
  }

  return ok(execNode(loc(tag), exprR.value));
};
