import { TOKEN_SYMBOL } from '../../lexer/token-types.js';
import { nodes } from '../../nodes/index.js';
import { nextToken, pushToken, skipSymbol } from '../cursor.js';
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
      pushToken(ctx, tok);
    }
    if (skipSymbol(ctx, 'in')) {
      const node2 = parseIs(ctx);
      node = nodes.in(node.lineno, node.colno, node, node2);
      if (invert) {
        node = nodes.not(node.lineno, node.colno, node);
      }
    } else {
      if (invert) {
        pushToken(ctx, tok);
      }
      break;
    }
  }
  return node;
};
