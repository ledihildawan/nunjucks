import { compare, compareOperand } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { nextToken, pushToken } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseConcat } from "./concat.ts";

export const parseCompare = (ctx: ParserContext): Node => {
  const compareOps = ['==', '===', '!=', '!==', '<', '>', '<=', '>='];
  const expr = parseConcat(ctx);
  const ops: Node[] = [];

  for (;;) {
    const tok = nextToken(ctx);

    if (!tok) {
      break;
    }if (compareOps.includes(tok.value as string)) {
      ops.push(compareOperand(tok.lineno, tok.colno, parseConcat(ctx), tok.value as string));
    } else {
      pushToken(ctx, tok);
      break;
    }
  }

  const [firstOp] = ops;
  if (firstOp) {
    return compare(firstOp.lineno, firstOp.colno, expr, ops);
  }
    return expr;
};
