import { TOKEN_OPERATOR } from '../../lexer/token-types.js';
import { nodes } from '../../nodes/index.js';
import { peekToken, skipValue } from '../cursor.js';

export const parseUnary = (ctx, noPipes) => {
  const tok = peekToken(ctx);
  let node;

  if (skipValue(ctx, TOKEN_OPERATOR, '-')) {
    node = nodes.neg(tok.lineno, tok.colno, parseUnary(ctx, true));
  } else if (skipValue(ctx, TOKEN_OPERATOR, '+')) {
    node = nodes.pos(tok.lineno, tok.colno, parseUnary(ctx, true));
  } else {
    node = ctx.parsePrimary();
  }

  if (!noPipes) {
    node = ctx.parsePipe(node);
  }

  return node;
};
