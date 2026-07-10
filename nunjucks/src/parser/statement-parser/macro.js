import { Macro } from '../../nodes/index.js';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from '../cursor.js';

export const parseMacro = (ctx) => {
  const macroTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'macro')) {
    fail(ctx, 'expected macro');
  }

  const name = ctx.parsePrimary(true);
  const args = ctx.parseSignature();
  const node = Macro(macroTok.lineno, macroTok.colno, name, args);

  advanceAfterBlockEnd(ctx, macroTok.value);
  node.body = ctx.parseUntilBlocks('endmacro');
  advanceAfterBlockEnd(ctx);

  return node;
};
