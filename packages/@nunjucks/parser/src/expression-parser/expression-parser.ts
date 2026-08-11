import { inlineIf } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { skipSymbol } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';
import { ok, isErr, type Result } from '@nunjucks/lib';
import { parseOr, parseTernary } from './logical.ts';
import { parseWalrus } from './assignment.ts';
import { loc } from '@nunjucks/shared';

const parseTernaryExpression = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const nodeR = parseOr(parserContext);
  if (isErr(nodeR)) { return nodeR; }
  const node = nodeR.value;

  if (skipSymbol(parserContext, 'if')) {
    const condR = parseOr(parserContext);
    if (isErr(condR)) { return condR; }
    let alternate: Node | null = null;
    if (skipSymbol(parserContext, 'else')) {
      const altR = parseOr(parserContext);
      if (isErr(altR)) { return altR; }
      alternate = altR.value;
    }
    return ok(inlineIf(loc(node), { body: node, cond: condR.value, alternate }));
  }

  const ternaryR = parseTernary(parserContext, node);
  if (isErr(ternaryR)) { return ternaryR; }
  return parseWalrus(parserContext, ternaryR.value);
};

const parseExpression = (parserContext: ParserContext): Result<Node, TemplateError> => parseTernaryExpression(parserContext);

export { parseExpression };
export { parsePrimary } from './primary.ts';
