import { Compare, CompareOperand } from '../../nodes/index.js';
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
      ops.push(CompareOperand(tok.lineno, tok.colno, parseConcat(ctx), tok.value));
    } else {
      pushToken(ctx, tok);
      break;
    }
  }

  if (ops.length) {
    return Compare(ops[0].lineno, ops[0].colno, expr, ops);
  } else {
    return expr;
  }
};
