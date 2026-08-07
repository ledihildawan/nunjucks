import { include } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";

export const parseInclude = (parserContext: ParserContext): Node => {
  const tagName = 'include';
  const tag = peekToken(parserContext);
  if (!skipSymbol(parserContext, tagName)) {
    fail(parserContext, `parseInclude: expected ${tagName}`);
  }

  const node = include(tag.lineno, tag.colno);
  node.template = parseExpression(parserContext);

  if (skipSymbol(parserContext, 'only')) {
    node.only = true;
  } else if (skipSymbol(parserContext, 'with')) {
    node.with = parseExpression(parserContext);
  }

  if (skipSymbol(parserContext, 'ignore') && skipSymbol(parserContext, 'missing')) {
    node.ignoreMissing = true;
  }

  advanceAfterBlockEnd(parserContext, String(tag.value));
  return node;
};
