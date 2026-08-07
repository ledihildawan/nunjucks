import { extendsNode } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";

export const parseExtends = (parserContext: ParserContext): Node => {
  const tagName = 'extends';
  const tag = peekToken(parserContext);
  if (!skipSymbol(parserContext, tagName)) {
    fail(parserContext, `parseExtends: expected ${tagName}`);
  }

  const node = extendsNode(tag.lineno, tag.colno);
  node.template = parseExpression(parserContext);

  advanceAfterBlockEnd(parserContext, String(tag.value));
  return node;
};
