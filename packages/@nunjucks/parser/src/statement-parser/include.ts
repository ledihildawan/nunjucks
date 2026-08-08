import { include } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/shared';
import { parseExpression } from "../expression-parser/index.ts";
import { loc } from '@nunjucks/shared';

export const parseInclude = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagName = 'include';
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) { return tagR; }
  const tag = tagR.value;
  if (!skipSymbol(parserContext, tagName)) {
    return fail(parserContext, `parseInclude: expected ${tagName}`);
  }

  const node = include(loc(tag));
  const templateR = parseExpression(parserContext);
  if (isErr(templateR)) { return templateR; }
  node.template = templateR.value;

  if (skipSymbol(parserContext, 'only')) {
    node.only = true;
  } else if (skipSymbol(parserContext, 'with')) {
    const withR = parseExpression(parserContext);
    if (isErr(withR)) { return withR; }
    node.with = withR.value;
  }

  if (skipSymbol(parserContext, 'ignore') && skipSymbol(parserContext, 'missing')) {
    node.ignoreMissing = true;
  }

  const blockEndR = advanceAfterBlockEnd(parserContext, String(tag.value));
  if (isErr(blockEndR)) { return blockEndR; }
  return ok(node);
};
