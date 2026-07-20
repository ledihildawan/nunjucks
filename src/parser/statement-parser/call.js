import {
  nodes,
} from '../../nodes/index.js';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from '../cursor.js';

export const parseCall = (ctx) => {
  const callTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'call')) {
    fail(ctx, 'expected call');
  }

  const callerArgs = ctx.parseSignature(true) || nodes.nodeList();
  const macroCall = ctx.parsePrimary();

  advanceAfterBlockEnd(ctx, callTok.value);
  const body = ctx.parseUntilBlocks('endcall');
  advanceAfterBlockEnd(ctx);

  return nodes.call(callTok.lineno,
    callTok.colno,
    macroCall,
    callerArgs,
    body);
};
