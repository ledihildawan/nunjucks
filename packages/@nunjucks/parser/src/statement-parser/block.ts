import { block, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parsePrimary } from "../expression-parser/index.ts";
import { parseUntilBlocks } from "../parse-root.ts";

export const parseBlock = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'block')) {
    fail(ctx, 'parseBlock: expected block', tag.lineno, tag.colno);
  }

  const name = parsePrimary(ctx);
  if (!isSymbol(name)) {
    fail(ctx, 'parseBlock: variable name expected',
      tag.lineno,
      tag.colno);
  }

  advanceAfterBlockEnd(ctx, 'block');

  const body = parseUntilBlocks(ctx, 'endblock');
  skipSymbol(ctx, 'endblock');
  skipSymbol(ctx, String(name.value));

  const tok = peekToken(ctx);
  if (!tok) {
    fail(ctx, 'parseBlock: expected endblock, got end of file');
  }

  advanceAfterBlockEnd(ctx, String(tok.value));

  return block(tag.lineno, tag.colno, String(name.value), body);
};
