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

  const callerArgs = ctx.parseSignature(true) || NodeList();
  const macroCall = ctx.parsePrimary();

  advanceAfterBlockEnd(ctx, callTok.value);
  const body = ctx.parseUntilBlocks('endcall');
  advanceAfterBlockEnd(ctx);

  const callerName = AstSymbol(callTok.lineno,
    callTok.colno,
    'caller');
  const callerNode = Caller(callTok.lineno,
    callTok.colno,
    callerName,
    callerArgs,
    body);

  const args = macroCall.args.children;
  if (args[args.length - 1]?.typename !== 'KeywordArgs') {
    args.push(KeywordArgs());
  }
  const kwargs = args[args.length - 1];
  kwargs.addChild(Pair(callTok.lineno,
    callTok.colno,
    callerName,
    callerNode));

  return Output(callTok.lineno,
    callTok.colno,
    [macroCall]);
};
