import { nodes } from '@nunjucks/nodes';
import { skipSymbol, nextToken } from "../cursor.ts";

export const parseDo = (ctx) => {
  const tag = skipSymbol(ctx, 'do');
  
  const expr = ctx.parseExpression();
  
  // Consume the block-end token
  nextToken(ctx);
  
  return nodes.do(tag.lineno, tag.colno, expr);
};
