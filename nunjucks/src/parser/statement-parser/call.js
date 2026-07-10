import {
  NodeList,
  Pair,
  KeywordArgs,
  Output,
  Caller,
  AstSymbol,
} from '../../nodes/index.js';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from '../cursor.js';

export const parseCall = (ctx) => {
  const callTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'call')) {
    fail(ctx, 'expected call');
  }

  const callerArgs = ctx.parseSignature(true) || new NodeList();
  const macroCall = ctx.parsePrimary();

  advanceAfterBlockEnd(ctx, callTok.value);
  const body = ctx.parseUntilBlocks('endcall');
  advanceAfterBlockEnd(ctx);

  const callerName = new AstSymbol(callTok.lineno,
    callTok.colno,
    'caller');
  const callerNode = new Caller(callTok.lineno,
    callTok.colno,
    callerName,
    callerArgs,
    body);

  const args = macroCall.args.children;
  if (!(args[args.length - 1] instanceof KeywordArgs)) {
    args.push(new KeywordArgs());
  }
  const kwargs = args[args.length - 1];
  kwargs.addChild(new Pair(callTok.lineno,
    callTok.colno,
    callerName,
    callerNode));

  return new Output(callTok.lineno,
    callTok.colno,
    [macroCall]);
};
