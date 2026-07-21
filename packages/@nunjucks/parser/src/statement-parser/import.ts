import { nodes } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import { parseWithContext } from "./with.ts";

export const parseImport = (ctx) => {
  const importTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'import')) {
    fail(ctx, 'parseImport: expected import',
      importTok.lineno,
      importTok.colno);
  }

  const template = ctx.parseExpression();

  if (!skipSymbol(ctx, 'as')) {
    fail(ctx, 'parseImport: expected "as" keyword',
      importTok.lineno,
      importTok.colno);
  }

  const target = ctx.parseExpression();
  const withContext = parseWithContext(ctx);
  const node = nodes.import(importTok.lineno,
    importTok.colno,
    template,
    target,
    withContext);

  advanceAfterBlockEnd(ctx, importTok.value);

  return node;
};
