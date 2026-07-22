import { import_ } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";
import { parseWithContext } from "./with.ts";

export const parseImport = (ctx: ParserContext): Node => {
  const importTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'import')) {
    fail(ctx, 'parseImport: expected import',
      importTok.lineno,
      importTok.colno);
  }

  const template = parseExpression(ctx);

  if (!skipSymbol(ctx, 'as')) {
    fail(ctx, 'parseImport: expected "as" keyword',
      importTok.lineno,
      importTok.colno);
  }

  const target = parseExpression(ctx);
  const withContext = parseWithContext(ctx);
  const node = import_(importTok.lineno,
    importTok.colno,
    template,
    target as unknown as string,
    withContext as boolean);

  advanceAfterBlockEnd(ctx, importTok.value as string);

  return node;
};
