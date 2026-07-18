import { TOKEN_SYMBOL } from '../../lexer/token-types.js';
import { nodes } from '../../nodes/index.js';
import { nextToken, pushToken } from '../cursor.js';
import { parseIs } from './is.js';

export const parseIn = (ctx) => {
  let node = parseIs(ctx);
  while (true) {
    const tok = nextToken(ctx);
    if (!tok) {
      break;
    }
    const invert = tok.type === TOKEN_SYMBOL && tok.value === 'not';
    if (!invert) {
      if (tok.type !== TOKEN_SYMBOL || tok.value !== 'in') {
        pushToken(ctx, tok);
        break;
      }
    }

    const inTok = invert ? nextToken(ctx) : tok;
    if (inTok && inTok.type === TOKEN_SYMBOL && inTok.value === 'in') {
      const node2 = parseIs(ctx);
      node = nodes.in(inTok.lineno, inTok.colno, node, node2);
      if (invert) {
        node = nodes.not(tok.lineno, tok.colno, node);
      }
    } else {
      if (inTok) pushToken(ctx, inTok);
      break;
    }
  }
  return node;
};
