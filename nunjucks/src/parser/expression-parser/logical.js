import { Or, And, Not, In as OperatorIn } from '../../nodes/index.js';
import { peekToken, skipSymbol } from '../cursor.js';
import { parseNullishCoalesce } from './nullish.js';
import { parseIn } from './in.js';
import { parseIs } from './is.js';

export const parseOr = (ctx) => {
  let node = parseNullishCoalesce(ctx);
  while (skipSymbol(ctx, 'or')) {
    const node2 = parseNullishCoalesce(ctx);
    node = new Or(node.lineno, node.colno, node, node2);
  }
  return node;
};

export const parseAnd = (ctx) => {
  let node = parseNot(ctx);
  while (skipSymbol(ctx, 'and')) {
    const node2 = parseNot(ctx);
    node = new And(node.lineno, node.colno, node, node2);
  }
  return node;
};

export const parseNot = (ctx) => {
  const tok = peekToken(ctx);
  if (skipSymbol(ctx, 'not')) {
    return new Not(tok.lineno, tok.colno, parseNot(ctx));
  }
  return parseIn(ctx);
};
