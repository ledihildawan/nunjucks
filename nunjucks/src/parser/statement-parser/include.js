import { Include } from '../../nodes/index.js';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from '../cursor.js';

export const parseInclude = (ctx) => {
  const tagName = 'include';
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, tagName)) {
    fail(ctx, 'parseInclude: expected ' + tagName);
  }

  const node = Include(tag.lineno, tag.colno);
  node.template = ctx.parseExpression();

  if (skipSymbol(ctx, 'ignore') && skipSymbol(ctx, 'missing')) {
    node.ignoreMissing = true;
  }

  advanceAfterBlockEnd(ctx, tag.value);
  return node;
};
