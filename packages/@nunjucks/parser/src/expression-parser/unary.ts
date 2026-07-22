import { TOKEN_OPERATOR } from '@nunjucks/lexer';
import { bitwiseNot, decrement, increment, neg, pos } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipValue } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parsePrimary } from "./primary.ts";
import { parsePipe } from "../postfix-parser/index.ts";

export const parseUnary = (ctx: ParserContext, noPipes?: boolean): Node => {
  const tok = peekToken(ctx);
  let node: Node;

  if (skipValue(ctx, TOKEN_OPERATOR, '-')) {
    node = neg(tok.lineno, tok.colno, parseUnary(ctx, true));
  } else if (skipValue(ctx, TOKEN_OPERATOR, '+')) {
    node = pos(tok.lineno, tok.colno, parseUnary(ctx, true));
  } else if (skipValue(ctx, TOKEN_OPERATOR, '~')) {
    node = bitwiseNot(tok.lineno, tok.colno, parseUnary(ctx, true));
  } else if (skipValue(ctx, TOKEN_OPERATOR, '++')) {
    node = increment(tok.lineno, tok.colno, parseUnary(ctx, true), false);
  } else if (skipValue(ctx, TOKEN_OPERATOR, '--')) {
    node = decrement(tok.lineno, tok.colno, parseUnary(ctx, true), false);
  } else {
    node = parsePrimary(ctx);
  }

  if (!noPipes) {
    node = parsePipe(ctx, node);
  }

  return node;
};
