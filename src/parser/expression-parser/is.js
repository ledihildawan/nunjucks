import { nodes } from '../../nodes/index.js';
import { peekToken, skipSymbol } from '../cursor.js';
import { parseCompare } from './compare.js';

export const parseIs = (ctx) => {
  let node = parseCompare(ctx);
  const tok = peekToken(ctx);
  if (skipSymbol(ctx, 'is')) {
    const not = skipSymbol(ctx, 'not');
    const node2 = parseCompare(ctx);
    node = nodes.is(tok.lineno, tok.colno, node, node2);
    if (not) {
      node = nodes.not(tok.lineno, tok.colno, node);
    }
  }
  return node;
};
