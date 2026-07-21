import { nodes } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parsePrimary } from "../expression-parser/index.ts";
import { parseSignature } from "../node-parsers/index.ts";
import { parseUntilBlocks } from "../top-level.ts";

export const parseMacro = (ctx: ParserContext): Node => {
  const macroTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'macro')) {
    fail(ctx, 'expected macro');
  }

  const name = parsePrimary(ctx, true);
  const args = parseSignature(ctx);
  const node = nodes.macro(macroTok.lineno, macroTok.colno, name as unknown as string, args as unknown as Node[]);

  advanceAfterBlockEnd(ctx, macroTok.value as string);
  node.body = parseUntilBlocks(ctx, 'endmacro');
  advanceAfterBlockEnd(ctx);

  return node;
};
