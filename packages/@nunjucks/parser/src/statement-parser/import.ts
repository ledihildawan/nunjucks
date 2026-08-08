import { importNode, isSymbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";
import { parseWithContext } from "./import-context.ts";
import { loc } from '@nunjucks/shared';

export const parseImport = (parserContext: ParserContext): Node => {
  const importTok = peekToken(parserContext);
  if (!skipSymbol(parserContext, 'import')) {
    fail(parserContext, 'parseImport: expected import',
      importTok.lineno,
      importTok.colno);
  }

  const template = parseExpression(parserContext);

  if (!skipSymbol(parserContext, 'as')) {
    fail(parserContext, 'parseImport: expected "as" keyword',
      importTok.lineno,
      importTok.colno);
  }

  const target = parseExpression(parserContext);
  const withContext = parseWithContext(parserContext);
  if (!isSymbol(target)) { fail(parserContext, 'parseImport: expected import target', target.lineno, target.colno); }
  const node = importNode(loc(importTok), {
    template,
    target: String(target.value),
    withContext: withContext ?? false,
  });

  advanceAfterBlockEnd(parserContext, String(importTok.value));

  return node;
};
