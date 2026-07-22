import { extends_ } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";

export const parseExtends = (ctx: ParserContext): Node => {
  const tagName = 'extends';
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, tagName)) {
    fail(ctx, 'parseTemplateRef: expected ' + tagName);
  }

  const node = extends_(tag.lineno, tag.colno);
  node.template = parseExpression(ctx);

  advanceAfterBlockEnd(ctx, tag.value as string);
  return node;
};
