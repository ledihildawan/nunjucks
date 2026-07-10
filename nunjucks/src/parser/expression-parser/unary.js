import { TOKEN_OPERATOR } from '../../lexer/token-types.js';
import { Neg, Pos } from '../../nodes/index.js';
import { peekToken, skipValue } from '../cursor.js';

export const parseUnary = (ctx, noPipes) => {
  const tok = peekToken(ctx);
  let node;

  if (skipValue(ctx, TOKEN_OPERATOR, '-')) {
    node = new Neg(tok.lineno, tok.colno, parseUnary(ctx, true));
  } else if (skipValue(ctx, TOKEN_OPERATOR, '+')) {
    node = new Pos(tok.lineno, tok.colno, parseUnary(ctx, true));
  } else {
    node = ctx.parsePrimary();
  }

  if (!noPipes) {
    node = ctx.parsePipe(node);
  }

  return node;
};
