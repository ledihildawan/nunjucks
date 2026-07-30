import { do_ } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, nextToken, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/inline.ts";

export const parseDo = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'do')) { fail(ctx, 'expected do', tag.lineno, tag.colno); }

  const expr = parseExpression(ctx);

  // Consume the block-end token
  nextToken(ctx);

  return do_(tag.lineno, tag.colno, expr);
};
