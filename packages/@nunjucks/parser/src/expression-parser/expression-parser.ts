import { inlineIf } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { skipSymbol } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';
import { parseOr, parseTernary } from './logical.ts';
import { parseWalrus } from './assignment.ts';

const parseTernaryExpression = (ctx: ParserContext): Node => {
  const node = parseOr(ctx);

  if (skipSymbol(ctx, 'if')) {
    const condNode = parseOr(ctx);
    const else_ = skipSymbol(ctx, 'else') ? parseOr(ctx) : null;
    return inlineIf(node.lineno, node.colno, { body: node, cond: condNode, else_ });
  }

  return parseWalrus(ctx, parseTernary(ctx, node));
};

const parseExpression = (ctx: ParserContext): Node => parseTernaryExpression(ctx);

export { parseExpression };
export { parsePrimary } from './primary.ts';
