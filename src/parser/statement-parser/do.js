import { nodes } from '../../nodes/index.js';
import { skipSymbol, nextToken } from '../cursor.js';

export const parseDo = (ctx) => {
  const tag = skipSymbol(ctx, 'do');
  
  const expr = ctx.parseExpression();
  
  // Consume the block-end token
  const endTok = nextToken(ctx);
  
  return nodes.do(tag.lineno, tag.colno, expr);
};
