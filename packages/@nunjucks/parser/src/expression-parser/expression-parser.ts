import { inlineIf } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { skipSymbol } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';
import { parseOr, parseTernary } from './logical.ts';
import { parseWalrus } from './assignment.ts';
import { loc } from '@nunjucks/shared';

const parseTernaryExpression = (parserContext: ParserContext): Node => {
  const node = parseOr(parserContext);

  if (skipSymbol(parserContext, 'if')) {
    const condNode = parseOr(parserContext);
    const else_ = skipSymbol(parserContext, 'else') ? parseOr(parserContext) : null;
    return inlineIf(loc(node), { body: node, cond: condNode, else_ });
  }

  return parseWalrus(parserContext, parseTernary(parserContext, node));
};

const parseExpression = (parserContext: ParserContext): Node => parseTernaryExpression(parserContext);

export { parseExpression };
export { parsePrimary } from './primary.ts';
