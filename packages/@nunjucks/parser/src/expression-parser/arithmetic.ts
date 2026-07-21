import { TOKEN_OPERATOR } from '@nunjucks/lexer';
import { nodes } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipValue } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseUnary } from "./unary.ts";

type BinNodeFn = (lineno: number, colno: number, left: Node, right: Node) => Node;

const binaryOp = (ctx: ParserContext, NodeClass: BinNodeFn, operator: string, next: (ctx: ParserContext) => Node): Node => {
  let node = next(ctx);
  let tok = peekToken(ctx);
  while (skipValue(ctx, TOKEN_OPERATOR, operator)) {
    const node2 = next(ctx);
    node = NodeClass(tok.lineno, tok.colno, node, node2);
    tok = peekToken(ctx);
  }
  return node;
};

export const parseAdd = (ctx: ParserContext): Node => binaryOp(ctx, nodes.add, '+', parseSub);
export const parseSub = (ctx: ParserContext): Node => binaryOp(ctx, nodes.sub, '-', parseMul);
export const parseMul = (ctx: ParserContext): Node => binaryOp(ctx, nodes.mul, '*', parseDiv);
export const parseDiv = (ctx: ParserContext): Node => binaryOp(ctx, nodes.div, '/', parseFloorDiv);
export const parseFloorDiv = (ctx: ParserContext): Node => binaryOp(ctx, nodes.floorDiv, '//', parseMod);
export const parseMod = (ctx: ParserContext): Node => binaryOp(ctx, nodes.mod, '%', parsePow);
export const parsePow = (ctx: ParserContext): Node => binaryOp(ctx, nodes.pow, '**', parseUnary);
