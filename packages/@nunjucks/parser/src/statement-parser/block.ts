import { nodes } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parsePrimary } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../top-level.ts";

export const parseBlock = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'block')) {
    fail(ctx, 'parseBlock: expected block', tag.lineno, tag.colno);
  }

  const node = nodes.block(tag.lineno, tag.colno);

  node.name = parsePrimary(ctx);
  if (!nodes.isSymbol(node.name)) {
    fail(ctx, 'parseBlock: variable name expected',
      tag.lineno,
      tag.colno);
  }

  advanceAfterBlockEnd(ctx, tag.value as string);

  node.body = parseUntilBlocks(ctx, 'endblock');
  skipSymbol(ctx, 'endblock');
  skipSymbol(ctx, (node.name as { value: string }).value);

  const tok = peekToken(ctx);
  if (!tok) {
    fail(ctx, 'parseBlock: expected endblock, got end of file');
  }

  advanceAfterBlockEnd(ctx, tok.value as string);

  return node;
};
