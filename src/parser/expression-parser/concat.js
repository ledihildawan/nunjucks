import { nodes } from '../../nodes/index.js';
import { TOKEN_TILDE } from '../../lexer/token-types.js';
import { peekToken, skipValue } from '../cursor.js';
import { parseAdd } from './arithmetic.js';

export const parseConcat = (ctx) => {
  let node = parseAdd(ctx);
  let tok = peekToken(ctx);
  while (skipValue(ctx, TOKEN_TILDE, '~')) {
    const node2 = parseAdd(ctx);
    node = nodes.concat(tok.lineno, tok.colno, node, node2);
    tok = peekToken(ctx);
  }
  return node;
};
