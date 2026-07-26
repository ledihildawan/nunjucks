import { include } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/inline.ts";

export const parseInclude = (ctx: ParserContext): Node => {
  const tagName = 'include';
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, tagName)) {
    fail(ctx, `parseInclude: expected ${tagName}`);
  }

  const node = include(tag.lineno, tag.colno);
  node.template = parseExpression(ctx);

  if (skipSymbol(ctx, 'only')) {
    node.only = true;
  } else if (skipSymbol(ctx, 'with')) {
    node.with = parseExpression(ctx);
  }

  if (skipSymbol(ctx, 'ignore') && skipSymbol(ctx, 'missing')) {
    node.ignoreMissing = true;
  }

  advanceAfterBlockEnd(ctx, tag.value as string);
  return node;
};
