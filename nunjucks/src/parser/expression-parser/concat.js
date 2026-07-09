import { Concat } from '../../nodes.js';
import * as lexer from '../../lexer/index.js';
import { skipValue } from '../cursor.js';
import { parseAdd } from './arithmetic.js';

export const parseConcat = (ctx) => {
  let node = parseAdd(ctx);
  while (skipValue(ctx, lexer.TOKEN_TILDE, '~')) {
    const node2 = parseAdd(ctx);
    node = new Concat(node.lineno, node.colno, node, node2);
  }
  return node;
};
