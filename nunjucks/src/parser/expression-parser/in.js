import * as lexer from '../../lexer/index.js';
import { In as OperatorIn, Not } from '../../nodes.js';
import { nextToken, peekToken, pushToken, skipSymbol } from '../cursor.js';
import { parseIs } from './is.js';

export const parseIn = (ctx) => {
  let node = parseIs(ctx);
  while (1) {
    const tok = nextToken(ctx);
    if (!tok) {
      break;
    }
    const invert = tok.type === lexer.TOKEN_SYMBOL && tok.value === 'not';
    if (!invert) {
      pushToken(ctx, tok);
    }
    if (skipSymbol(ctx, 'in')) {
      const node2 = parseIs(ctx);
      node = new OperatorIn(node.lineno, node.colno, node, node2);
      if (invert) {
        node = new Not(node.lineno, node.colno, node);
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
