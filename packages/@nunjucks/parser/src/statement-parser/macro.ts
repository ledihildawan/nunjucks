import { nodes } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";

export const parseMacro = (ctx) => {
  const macroTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'macro')) {
    fail(ctx, 'expected macro');
  }

  const name = ctx.parsePrimary(true);
  const args = ctx.parseSignature();
  const node = nodes.macro(macroTok.lineno, macroTok.colno, name, args);

  advanceAfterBlockEnd(ctx, macroTok.value);
  node.body = ctx.parseUntilBlocks('endmacro');
  advanceAfterBlockEnd(ctx);

  return node;
};
