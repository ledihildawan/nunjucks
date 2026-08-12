import { extendsNode } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/lib';
import { parseExpression } from "../expression-parser/index.ts";
import { loc } from '@nunjucks/lexer';

export const parseExtends = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagName = 'extends';
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) { return tagR; }
  const tag = tagR.value;
  if (!skipSymbol(parserContext, tagName)) {
    return fail(parserContext, `parseExtends: expected ${tagName}`);
  }

  const templateR = parseExpression(parserContext);
  if (isErr(templateR)) { return templateR; }

  const blockEndR = advanceAfterBlockEnd(parserContext, String(tag.value));
  if (isErr(blockEndR)) { return blockEndR; }
  return ok(extendsNode(loc(tag), { template: templateR.value }));
};
