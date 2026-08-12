import { execNode } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { peekToken, skipSymbol, nextToken, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/lib';
import { parseExpression } from "../expression-parser/index.ts";
import { loc } from '@nunjucks/lexer';

export const parseExec = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) { return tagR; }
  const tag = tagR.value;
  if (!skipSymbol(parserContext, 'exec')) {
    return fail(parserContext, 'expected exec', { lineno: tag.lineno, colno: tag.colno });
  }

  const exprR = parseExpression(parserContext);
  if (isErr(exprR)) { return exprR; }

  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) { return consumedR; }

  return ok(execNode(loc(tag), exprR.value));
};
