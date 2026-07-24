import { bitwiseAnd, bitwiseLShift, bitwiseOr, bitwiseRShift, bitwiseXor } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { nextToken, pushToken } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseIs } from "./is.ts";

type BinNodeFn = (lineno: number, colno: number, left: Node, right: Node) => Node;

const bitwiseNodeMap: Record<string, BinNodeFn> = {
  '|': bitwiseOr,
  '&': bitwiseAnd,
  '^': bitwiseXor,
  '<<': bitwiseLShift,
  '>>': bitwiseRShift
};

export const parseBitwiseOr = (ctx: ParserContext): Node => {
  let node = parseIs(ctx);
  const tok = nextToken(ctx);

  if (!tok) {
    return node;
  }

  const createNode = bitwiseNodeMap[tok.value as string];
  if (createNode) {
    const right = parseIs(ctx);
    node = createNode(tok.lineno, tok.colno, node, right);
  } else {
    pushToken(ctx, tok);
  }

  return node;
};
