import { nodes } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";

export const parseExtends = (ctx) => {
  const tagName = 'extends';
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, tagName)) {
    fail(ctx, 'parseTemplateRef: expected ' + tagName);
  }

  const node = nodes.extends(tag.lineno, tag.colno);
  node.template = ctx.parseExpression();

  advanceAfterBlockEnd(ctx, tag.value);
  return node;
};
