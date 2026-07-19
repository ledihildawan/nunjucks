import { TOKEN_OPERATOR } from '../../lexer/token-types.js';
import { nodes } from '../../nodes/index.js';
import { peekToken, skipValue, nextToken } from '../cursor.js';

export const parseUnary = (ctx, noPipes) => {
  const tok = peekToken(ctx);
  let node;

  if (skipValue(ctx, TOKEN_OPERATOR, '-')) {
    node = nodes.neg(tok.lineno, tok.colno, parseUnary(ctx, true));
  } else if (skipValue(ctx, TOKEN_OPERATOR, '+')) {
    node = nodes.pos(tok.lineno, tok.colno, parseUnary(ctx, true));
  } else if (skipValue(ctx, TOKEN_OPERATOR, '~')) {
    node = nodes.bitwiseNot(tok.lineno, tok.colno, parseUnary(ctx, true));
  } else if (skipValue(ctx, TOKEN_OPERATOR, '++')) {
    node = nodes.increment(tok.lineno, tok.colno, parseUnary(ctx, true), false);
  } else if (skipValue(ctx, TOKEN_OPERATOR, '--')) {
    node = nodes.decrement(tok.lineno, tok.colno, parseUnary(ctx, true), false);
  } else {
    node = ctx.parsePrimary();
  }

  if (!noPipes) {
    node = ctx.parsePipe(node);
  }

  return node;
};
