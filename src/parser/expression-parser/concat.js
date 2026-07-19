import { nodes } from '../../nodes/index.js';
import { TOKEN_OPERATOR } from '../../lexer/token-types.js';
import { peekToken, nextToken } from '../cursor.js';
import { parseAdd } from './arithmetic.js';

export const parseConcat = (ctx) => {
  let node = parseAdd(ctx);
  let tok = peekToken(ctx);
  while (tok && tok.type === TOKEN_OPERATOR && tok.value === '+') {
    nextToken(ctx);
    const node2 = parseAdd(ctx);
    node = nodes.concat(tok.lineno, tok.colno, node, node2);
    tok = peekToken(ctx);
  }
  return node;
};
