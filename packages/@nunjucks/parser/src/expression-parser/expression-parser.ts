import type { TemplateError } from '@nunjucks/error-formatter';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { inlineIf } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { skipSymbol } from '../cursor.ts';
import { parseWalrus } from './assignment.ts';
import { parseOr, parseTernary } from './logical.ts';

const parseTernaryExpression = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const nodeR = parseOr(parserContext);
  if (isErr(nodeR)) {
    return nodeR;
  }
  const node = nodeR.value;

  if (skipSymbol(parserContext, 'if')) {
    const condR = parseOr(parserContext);
    if (isErr(condR)) {
      return condR;
    }
    let alternate: Node | null = null;
    if (skipSymbol(parserContext, 'else')) {
      const altR = parseOr(parserContext);
      if (isErr(altR)) {
        return altR;
      }
      alternate = altR.value;
    }
    return ok(inlineIf(loc(node), { body: node, cond: condR.value, alternate }));
  }

  const ternaryR = parseTernary(parserContext, node);
  if (isErr(ternaryR)) {
    return ternaryR;
  }
  return parseWalrus(parserContext, ternaryR.value);
};

const parseExpression = (parserContext: ParserContext): Result<Node, TemplateError> =>
  parseTernaryExpression(parserContext);

export { parsePrimary } from './primary.ts';
export { parseExpression };
