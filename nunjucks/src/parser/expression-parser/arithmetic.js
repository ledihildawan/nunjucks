import * as lexer from '../../lexer/index.js';
import { Add, Sub, Mul, Div, FloorDiv, Mod, Pow } from '../../nodes.js';
import { skipValue } from '../cursor.js';
import { parseUnary } from './unary.js';

const binaryOp = (ctx, NodeClass, operator, next) => {
  let node = next(ctx);
  while (skipValue(ctx, lexer.TOKEN_OPERATOR, operator)) {
    const node2 = next(ctx);
    node = new NodeClass(node.lineno, node.colno, node, node2);
  }
  return node;
};

export const parseAdd = (ctx) => binaryOp(ctx, Add, '+', parseSub);
export const parseSub = (ctx) => binaryOp(ctx, Sub, '-', parseMul);
export const parseMul = (ctx) => binaryOp(ctx, Mul, '*', parseDiv);
export const parseDiv = (ctx) => binaryOp(ctx, Div, '/', parseFloorDiv);
export const parseFloorDiv = (ctx) => binaryOp(ctx, FloorDiv, '//', parseMod);
export const parseMod = (ctx) => binaryOp(ctx, Mod, '%', parsePow);
export const parsePow = (ctx) => binaryOp(ctx, Pow, '**', parseUnary);
