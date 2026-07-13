import { nodes } from '../../nodes/index.js';
import { TOKEN_OPERATOR } from '../../lexer/token-types.js';
import { skipValue } from '../cursor.js';
import { parseAnd } from './logical.js';

export const parseNullishCoalesce = (ctx) => {
  let node = parseAnd(ctx);
  while (skipValue(ctx, TOKEN_OPERATOR, '??')) {
    const node2 = parseAnd(ctx);
    node = nodes.nullishCoalesce(node.lineno, node.colno, node, node2);
  }
  return node;
};
