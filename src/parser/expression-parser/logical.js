import { nodes } from '../../nodes/index.js';
import { peekToken, skipSymbol, skipOperator, nextToken } from '../cursor.js';
import { TOKEN_OPERATOR } from '../../lexer/token-types.js';
import { parseNullishCoalesce } from './nullish.js';
import { parseIn } from './in.js';

export const parseOr = (ctx) => {
  let node = parseNullishCoalesce(ctx);
  let tok = peekToken(ctx);
  while (skipSymbol(ctx, 'or') || skipOperator(ctx, '||')) {
    const node2 = parseNullishCoalesce(ctx);
    node = nodes.or(tok.lineno, tok.colno, node, node2);
    tok = peekToken(ctx);
  }
  return node;
};

export const parseAnd = (ctx) => {
  let node = parseNot(ctx);
  let tok = peekToken(ctx);
  while (skipSymbol(ctx, 'and') || skipOperator(ctx, '&&')) {
    const node2 = parseNot(ctx);
    node = nodes.and(tok.lineno, tok.colno, node, node2);
    tok = peekToken(ctx);
  }
  return node;
};

export const parseNot = (ctx) => {
  const tok = peekToken(ctx);
  if (!tok) {
    return parseIn(ctx);
  }
  if (tok.type === TOKEN_OPERATOR && tok.value === '!') {
    nextToken(ctx);
    return nodes.not(tok.lineno, tok.colno, parseNot(ctx));
  }
  if (skipSymbol(ctx, 'not')) {
    return nodes.not(tok.lineno, tok.colno, parseNot(ctx));
  }
  if (skipOperator(ctx, '!')) {
    return nodes.not(tok.lineno, tok.colno, parseNot(ctx));
  }
  return parseIn(ctx);
};
