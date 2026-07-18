import { TOKEN_OPERATOR } from '../../lexer/token-types.js';
import { nodes } from '../../nodes/index.js';
import { peekToken, skipValue } from '../cursor.js';
import { parseUnary } from './unary.js';

const binaryOp = (ctx, NodeClass, operator, next) => {
  let node = next(ctx);
  let tok = peekToken(ctx);
  while (skipValue(ctx, TOKEN_OPERATOR, operator)) {
    const node2 = next(ctx);
    node = NodeClass(tok.lineno, tok.colno, node, node2);
    tok = peekToken(ctx);
  }
  return node;
};

export const parseAdd = (ctx) => binaryOp(ctx, nodes.add, '+', parseSub);
export const parseSub = (ctx) => binaryOp(ctx, nodes.sub, '-', parseMul);
export const parseMul = (ctx) => binaryOp(ctx, nodes.mul, '*', parseDiv);
export const parseDiv = (ctx) => binaryOp(ctx, nodes.div, '/', parseFloorDiv);
export const parseFloorDiv = (ctx) => binaryOp(ctx, nodes.floorDiv, '//', parseMod);
export const parseMod = (ctx) => binaryOp(ctx, nodes.mod, '%', parsePow);
export const parsePow = (ctx) => binaryOp(ctx, nodes.pow, '**', parseUnary);
