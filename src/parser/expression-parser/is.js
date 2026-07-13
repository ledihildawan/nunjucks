import { nodes } from '../../nodes/index.js';
import { skipSymbol } from '../cursor.js';
import { parseCompare } from './compare.js';

export const parseIs = (ctx) => {
  let node = parseCompare(ctx);
  if (skipSymbol(ctx, 'is')) {
    const not = skipSymbol(ctx, 'not');
    const node2 = parseCompare(ctx);
    node = nodes.is(node.lineno, node.colno, node, node2);
    if (not) {
      node = nodes.not(node.lineno, node.colno, node);
    }
  }
  return node;
};
