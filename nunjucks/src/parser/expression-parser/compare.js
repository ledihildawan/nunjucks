import { Compare, CompareOperand } from '../../nodes.js';
import { nextToken, pushToken } from '../cursor.js';
import { parseConcat } from './concat.js';

export const parseCompare = (ctx) => {
  const compareOps = ['==', '===', '!=', '!==', '<', '>', '<=', '>='];
  const expr = parseConcat(ctx);
  const ops = [];

  while (1) {
    const tok = nextToken(ctx);

    if (!tok) {
      break;
    } else if (compareOps.indexOf(tok.value) !== -1) {
      ops.push(new CompareOperand(tok.lineno, tok.colno, parseConcat(ctx), tok.value));
    } else {
      pushToken(ctx, tok);
      break;
    }
  }

  if (ops.length) {
    return new Compare(ops[0].lineno, ops[0].colno, expr, ops);
  } else {
    return expr;
  }
};
