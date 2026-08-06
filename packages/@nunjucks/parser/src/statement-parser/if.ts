import { if_ } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../parse-root.ts";

export const parseIf = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);

  if (!(skipSymbol(ctx, 'if') || skipSymbol(ctx, 'elif') || skipSymbol(ctx, 'elseif'))) {
    return fail(ctx, 'parseIf: expected if, elif, or elseif',
      tag.lineno,
      tag.colno);
  }

  const cond = parseExpression(ctx);
  advanceAfterBlockEnd(ctx, String(tag.value));

  const body = parseUntilBlocks(ctx, 'elif', 'elseif', 'else', 'endif');
  const tok = peekToken(ctx);

  let else_: Node | null = null;
  switch (tok?.value) {
    case 'elseif':
    case 'elif':
      else_ = parseIf(ctx);
      break;
    case 'else':
      advanceAfterBlockEnd(ctx);
      else_ = parseUntilBlocks(ctx, 'endif');
      advanceAfterBlockEnd(ctx);
      break;
    case 'endif':
      else_ = null;
      advanceAfterBlockEnd(ctx);
      break;
    default:
      fail(ctx, 'parseIf: expected elif, else, or endif, got end of file');
  }

  return if_(tag.lineno, tag.colno, { cond, body, else_ });
};
