import { TOKEN_SYMBOL } from '@nunjucks/lexer';
import { in_, not } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { nextToken, pushToken } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseBitwiseOr } from "./bitwise.ts";
import { parseIs } from "./is.ts";

export const parseIn = (ctx: ParserContext): Node => {
  let node = parseBitwiseOr(ctx);
  for (;;) {
    const tok = nextToken(ctx);
    if (!tok) {
      break;
    }
    const invert = tok.type === TOKEN_SYMBOL && tok.value === 'not';
    if (!invert && (tok.type !== TOKEN_SYMBOL || tok.value !== 'in')) {
        pushToken(ctx, tok);
        break;
      }

    let inTok;
    if (invert) {
      inTok = nextToken(ctx);
    } else {
      inTok = tok;
    }
    if (inTok && inTok.type === TOKEN_SYMBOL && inTok.value === 'in') {
      const node2 = parseIs(ctx);
      node = in_(inTok.lineno, inTok.colno, node, node2);
      if (invert) {
        node = not(tok.lineno, tok.colno, node);
      }
    } else {
      if (inTok) { pushToken(ctx, inTok); }
      break;
    }
  }
  return node;
};
