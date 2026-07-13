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

  const callerName = nodes.symbol(callTok.lineno,
    callTok.colno,
    'caller');
  const callerNode = nodes.caller(callTok.lineno,
    callTok.colno,
    callerName,
    callerArgs,
    body);

  const args = macroCall.args.children;
  if (!nodes.isKeywordArgs(args.at(-1))) {
    args.push(nodes.keywordArgs());
  }
  const kwargs = args.at(-1);
  kwargs.addChild(nodes.pair(callTok.lineno,
    callTok.colno,
    callerName,
    callerNode));

  return nodes.output(callTok.lineno,
    callTok.colno,
    [macroCall]);
};
