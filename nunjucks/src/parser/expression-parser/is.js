import { Is, Not } from '../../nodes.js';
import { skipSymbol } from '../cursor.js';
import { parseCompare } from './compare.js';

export const parseIs = (ctx) => {
  let node = parseCompare(ctx);
  if (skipSymbol(ctx, 'is')) {
    const not = skipSymbol(ctx, 'not');
    const node2 = parseCompare(ctx);
    node = new Is(node.lineno, node.colno, node, node2);
    if (not) {
      node = new Not(node.lineno, node.colno, node);
    }
  }
  return node;
};
