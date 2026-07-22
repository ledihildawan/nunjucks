import { is, not } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseCompare } from "./compare.ts";

export const parseIs = (ctx: ParserContext): Node => {
  let node = parseCompare(ctx);
  const tok = peekToken(ctx);
  if (skipSymbol(ctx, 'is')) {
    const negate = skipSymbol(ctx, 'not');
    const node2 = parseCompare(ctx);
    node = is(tok.lineno, tok.colno, node, node2);
    if (negate) {
      node = not(tok.lineno, tok.colno, node);
    }
  }
  return node;
};
