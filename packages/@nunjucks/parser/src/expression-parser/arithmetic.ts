import { add, sub, mul, div, floorDiv, mod, pow, concat, range } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { TOKEN_OPERATOR } from '@nunjucks/lexer';
import { skipValue } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';
import { binaryOp, op } from './internal.ts';
import { parseUnary } from './primary.ts';

const parseAdd = (ctx: ParserContext): Node => binaryOp(ctx, add, op('+'), parseSub);
const parseSub = (ctx: ParserContext): Node => binaryOp(ctx, sub, op('-'), parseMul);
const parseMul = (ctx: ParserContext): Node => binaryOp(ctx, mul, op('*'), parseDiv);
const parseDiv = (ctx: ParserContext): Node => binaryOp(ctx, div, op('/'), parseFloorDiv);
const parseFloorDiv = (ctx: ParserContext): Node => binaryOp(ctx, floorDiv, op('//'), parseMod);
const parseMod = (ctx: ParserContext): Node => binaryOp(ctx, mod, op('%'), parsePow);
const parsePow = (ctx: ParserContext): Node => binaryOp(ctx, pow, op('**'), parseUnary);

const parseConcat = (ctx: ParserContext): Node =>
  binaryOp(ctx, concat, (c) => skipValue(c, TOKEN_OPERATOR, '~'), parseRange);

const parseRange = (ctx: ParserContext): Node =>
  binaryOp(ctx, range, (c) => skipValue(c, TOKEN_OPERATOR, '..'), parseAdd);

export { parseConcat };
