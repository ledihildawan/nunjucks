import { Extends } from '../../nodes/index.js';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from '../cursor.js';

export const parseExtends = (ctx) => {
  const tagName = 'extends';
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, tagName)) {
    fail(ctx, 'parseTemplateRef: expected ' + tagName);
  }

  const node = new Extends(tag.lineno, tag.colno);
  node.template = ctx.parseExpression();

  advanceAfterBlockEnd(ctx, tag.value);
  return node;
};
