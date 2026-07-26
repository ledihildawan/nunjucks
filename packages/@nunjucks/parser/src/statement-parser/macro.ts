import { isSymbol, macro } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parsePrimary } from "../expression-parser/primary.ts";
import { parseSignature } from "../node-parsers/signature.ts";
import { parseUntilBlocks } from "../top-level.ts";

export const parseMacro = (ctx: ParserContext): Node => {
  const macroTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'macro')) {
    fail(ctx, 'expected macro');
  }

  const name = parsePrimary(ctx, true);
  const args = parseSignature(ctx);
  if (!isSymbol(name)) {
    fail(ctx, 'expected macro name', macroTok.lineno, macroTok.colno);
  }
  const node = macro(macroTok.lineno, macroTok.colno, { name: name.value as string, args: args?.children ?? [] });

  advanceAfterBlockEnd(ctx, macroTok.value as string);
  node.body = parseUntilBlocks(ctx, 'endmacro');
  advanceAfterBlockEnd(ctx);

  return node;
};
