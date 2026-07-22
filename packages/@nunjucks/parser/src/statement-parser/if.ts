import { if_ } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../top-level.ts";

export const parseIf = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);
  let node: Node;

  if (skipSymbol(ctx, 'if') || skipSymbol(ctx, 'elif') || skipSymbol(ctx, 'elseif')) {
    node = if_(tag.lineno, tag.colno);
  } else {
    return fail(ctx, 'parseIf: expected if, elif, or elseif',
      tag.lineno,
      tag.colno);
  }

  node.cond = parseExpression(ctx);
  advanceAfterBlockEnd(ctx, tag.value as string);

  node.body = parseUntilBlocks(ctx, 'elif', 'elseif', 'else', 'endif');
  const tok = peekToken(ctx);

  switch (tok && tok.value) {
    case 'elseif':
    case 'elif':
      node.else_ = parseIf(ctx);
      break;
    case 'else':
      advanceAfterBlockEnd(ctx);
      node.else_ = parseUntilBlocks(ctx, 'endif');
      advanceAfterBlockEnd(ctx);
      break;
    case 'endif':
      node.else_ = null;
      advanceAfterBlockEnd(ctx);
      break;
    default:
      fail(ctx, 'parseIf: expected elif, else, or endif, got end of file');
  }

  return node;
};
