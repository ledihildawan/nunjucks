import { nodes } from '../../nodes/index.js';
import { TOKEN_OPERATOR } from '../../lexer/token-types.js';
import { peekToken, skipValue } from '../cursor.js';
import { parseAnd } from './logical.js';

export const parseNullishCoalesce = (ctx) => {
  let node = parseAnd(ctx);
  let tok = peekToken(ctx);
  while (skipValue(ctx, TOKEN_OPERATOR, '??')) {
    const node2 = parseAnd(ctx);
    node = nodes.nullishCoalesce(tok.lineno, tok.colno, node, node2);
    tok = peekToken(ctx);
  }
  return node;
};
