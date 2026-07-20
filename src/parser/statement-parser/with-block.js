import { nodes } from '../../nodes/index.js';
import { skipSymbol, nextToken } from '../cursor.js';

export const parseWith = (ctx) => {
  const tag = skipSymbol(ctx, 'with');
  
  // Simple version - just consume the block content
  let tok = nextToken(ctx);
  while (tok && tok.type !== 'block-end') {
    tok = nextToken(ctx);
  }
  
  const body = ctx.parseUntilBlocks('endwith');
  
  skipSymbol(ctx, 'endwith');
  nextToken(ctx);
  
  return nodes.with(tag.lineno, tag.colno, [], body);
};
