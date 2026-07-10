import { InlineIf } from '../../nodes/index.js';
import { skipSymbol } from '../cursor.js';
import { parseOr } from './logical.js';

export const parseInlineIf = (ctx) => {
  let node = parseOr(ctx);
  if (skipSymbol(ctx, 'if')) {
    const condNode = parseOr(ctx);
    const bodyNode = node;
    node = InlineIf(node.lineno, node.colno);
    node.body = bodyNode;
    node.cond = condNode;
    if (skipSymbol(ctx, 'else')) {
      node.else_ = parseOr(ctx);
    } else {
      node.else_ = null;
    }
  }
  return node;
};

export const parseExpression = (ctx) => parseInlineIf(ctx);
