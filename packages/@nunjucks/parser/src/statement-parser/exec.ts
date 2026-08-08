import { execNode } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, nextToken, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";
import { loc } from '@nunjucks/shared';

export const parseExec = (parserContext: ParserContext): Node => {
  const tag = peekToken(parserContext);
  if (!skipSymbol(parserContext, 'exec')) { fail(parserContext, 'expected exec', tag.lineno, tag.colno); }

  const expr = parseExpression(parserContext);

  nextToken(parserContext);

  return execNode(loc(tag), expr);
};
