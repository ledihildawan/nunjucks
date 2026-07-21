import { nodes } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { nextToken, pushToken } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseConcat } from "./concat.ts";

export const parseCompare = (ctx: ParserContext): Node => {
  const compareOps = ['==', '===', '!=', '!==', '<', '>', '<=', '>='];
  const expr = parseConcat(ctx);
  const ops: Node[] = [];

  while (true) {
    const tok = nextToken(ctx);

    if (!tok) {
      break;
    } else if (compareOps.includes(tok.value as string)) {
      ops.push(nodes.compareOperand(tok.lineno, tok.colno, parseConcat(ctx), tok.value as string));
    } else {
      pushToken(ctx, tok);
      break;
    }
  }

  if (ops.length) {
    return nodes.compare(ops[0]!.lineno, ops[0]!.colno, expr, ops);
  } else {
    return expr;
  }
};
