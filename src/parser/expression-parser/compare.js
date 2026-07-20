import { nodes } from '../../nodes/index.js';
import { nextToken, pushToken } from '../cursor.js';
import { parseConcat } from './concat.js';

export const parseCompare = (ctx) => {
  const compareOps = ['==', '===', '!=', '!==', '<', '>', '<=', '>='];
  const expr = parseConcat(ctx);
  const ops = [];

  while (true) {
    const tok = nextToken(ctx);

    if (!tok) {
      break;
    } else if (compareOps.includes(tok.value)) {
      ops.push(nodes.compareOperand(tok.lineno, tok.colno, parseConcat(ctx), tok.value));
    } else {
      pushToken(ctx, tok);
      break;
    }
  }

  if (ops.length) {
    return nodes.compare(ops[0].lineno, ops[0].colno, expr, ops);
  } else {
    return expr;
  }
};
