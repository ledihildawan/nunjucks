import type { TemplateError } from '@nunjucks/error-formatter';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { extendsNode } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { advanceAfterBlockEnd, fail, peekToken, skipSymbol } from '../cursor.ts';
import { parseExpression } from '../expression-parser/index.ts';

export const parseExtends = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagName = 'extends';
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) {
    return tagR;
  }
  const tag = tagR.value;
  if (!skipSymbol(parserContext, tagName)) {
    return fail(parserContext, `parseExtends: expected ${tagName}`);
  }

  const templateR = parseExpression(parserContext);
  if (isErr(templateR)) {
    return templateR;
  }

  const blockEndR = advanceAfterBlockEnd(parserContext, String(tag.value));
  if (isErr(blockEndR)) {
    return blockEndR;
  }
  return ok(extendsNode(loc(tag), { template: templateR.value }));
};
