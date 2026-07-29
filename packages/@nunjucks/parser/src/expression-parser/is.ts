import { is, not } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseCompare } from "./compare.ts";

export const parseIs = (ctx: ParserContext): Node => {
  const initialNode = parseCompare(ctx);
  const tok = peekToken(ctx);
  if (!skipSymbol(ctx, 'is')) {
    return initialNode;
  }
  const negate = skipSymbol(ctx, 'not');
  const node2 = parseCompare(ctx);
  const isNode = is(tok.lineno, tok.colno, initialNode, node2);
  return negate ? not(tok.lineno, tok.colno, isNode) : isNode;
};
