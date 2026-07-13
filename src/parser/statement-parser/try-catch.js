import { nodes } from '../../nodes/index.js';
import { peekToken, skipValue, skipSymbol, nextToken, fail } from '../cursor.js';

export const parseTry = (ctx) => {
  const tag = skipSymbol(ctx, 'try');
  
  const tok = nextToken(ctx);
  if (tok && tok.type === 'block-end') {
    // consumed block end
  }
  
  const body = ctx.parseUntilBlocks('catch', 'endtry');
  
  let catchBody = null;
  let errVar = null;
  
  if (peekToken(ctx).value === 'catch') {
    skipSymbol(ctx, 'catch');
    
    const catchEnd = nextToken(ctx);
    if (catchEnd && catchEnd.type === 'block-end') {
      // consumed block end
    }
    
    if (peekToken(ctx).type === ctx.TOKEN_SYMBOL) {
      errVar = skipValue(ctx, ctx.TOKEN_SYMBOL).value;
    }
    
    catchBody = ctx.parseUntilBlocks('endtry');
  }
  
  if (peekToken(ctx).value === 'endtry') {
    skipSymbol(ctx, 'endtry');
    
    const endTok = nextToken(ctx);
    if (endTok && endTok.type === 'block-end') {
      // consumed block end
    }
  } else {
    fail(ctx, 'expected endtry, got ' + peekToken(ctx).value);
  }
  
  return nodes.tryCatch(tag.lineno, tag.colno, body, catchBody, errVar);
};
