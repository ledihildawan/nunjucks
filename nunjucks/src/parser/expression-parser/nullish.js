import { NullishCoalesce } from '../../nodes.js';
import * as lexer from '../../lexer/index.js';
import { skipValue } from '../cursor.js';
import { parseAnd } from './logical.js';

export const parseNullishCoalesce = (ctx) => {
  let node = parseAnd(ctx);
  while (skipValue(ctx, lexer.TOKEN_OPERATOR, '??')) {
    const node2 = parseAnd(ctx);
    node = new NullishCoalesce(node.lineno, node.colno, node, node2);
  }
  return node;
};
