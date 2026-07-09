import { Concat } from '../../nodes.js';
import { TOKEN_TILDE } from '../../lexer/token-types.js';
import { skipValue } from '../cursor.js';
import { parseAdd } from './arithmetic.js';

export const parseConcat = (ctx) => {
  let node = parseAdd(ctx);
  while (skipValue(ctx, TOKEN_TILDE, '~')) {
    const node2 = parseAdd(ctx);
    node = new Concat(node.lineno, node.colno, node, node2);
  }
  return node;
};
