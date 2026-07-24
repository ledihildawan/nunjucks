import { call, isSymbol, nodeList } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parsePrimary } from "../expression-parser/index.ts";
import { parseSignature } from "../node-parsers/index.ts";
import { parseUntilBlocks } from "../top-level.ts";

export const parseCall = (ctx: ParserContext): Node => {
  const callTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'call')) {
    fail(ctx, 'expected call');
  }

  const callerArgs = parseSignature(ctx, true) || nodeList(callTok.lineno, callTok.colno);
  const macroCall = parsePrimary(ctx);
  if (!isSymbol(macroCall)) { fail(ctx, 'expected macro name', macroCall.lineno, macroCall.colno); }

  advanceAfterBlockEnd(ctx, callTok.value as string);
  const body = parseUntilBlocks(ctx, 'endcall');
  advanceAfterBlockEnd(ctx);

  return call(callTok.lineno,
    callTok.colno,
    macroCall.value as string,
    callerArgs.children ?? [],
    body);
};
