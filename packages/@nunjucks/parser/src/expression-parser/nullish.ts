import { nodes } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { TOKEN_OPERATOR } from '@nunjucks/lexer';
import { peekToken, skipValue } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseAnd } from "./logical.ts";

export const parseNullishCoalesce = (ctx: ParserContext): Node => {
  let node = parseAnd(ctx);
  let tok = peekToken(ctx);
  while (skipValue(ctx, TOKEN_OPERATOR, '??')) {
    const node2 = parseAnd(ctx);
    node = nodes.nullishCoalesce(tok.lineno, tok.colno, node, node2);
    tok = peekToken(ctx);
  }
  return node;
};
