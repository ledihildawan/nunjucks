import { exec_ } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, nextToken, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";

export const parseExec = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'exec')) { fail(ctx, 'expected exec', tag.lineno, tag.colno); }

  const expr = parseExpression(ctx);

  nextToken(ctx);

  return exec_(tag.lineno, tag.colno, expr);
};
