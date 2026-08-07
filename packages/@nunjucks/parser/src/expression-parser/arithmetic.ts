import { add, sub, mul, div, floorDiv, mod, pow, concat, range } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { TOKEN_OPERATOR } from '@nunjucks/lexer';
import { skipValue } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';
import { binaryOp, op } from './binary-helpers.ts';
import { parseUnary } from './primary.ts';

const parseAdd = (parserContext: ParserContext): Node => binaryOp(parserContext, add, op('+'), parseSub);
const parseSub = (parserContext: ParserContext): Node => binaryOp(parserContext, sub, op('-'), parseMul);
const parseMul = (parserContext: ParserContext): Node => binaryOp(parserContext, mul, op('*'), parseDiv);
const parseDiv = (parserContext: ParserContext): Node => binaryOp(parserContext, div, op('/'), parseFloorDiv);
const parseFloorDiv = (parserContext: ParserContext): Node => binaryOp(parserContext, floorDiv, op('//'), parseMod);
const parseMod = (parserContext: ParserContext): Node => binaryOp(parserContext, mod, op('%'), parsePow);
const parsePow = (parserContext: ParserContext): Node => binaryOp(parserContext, pow, op('**'), parseUnary);

const parseConcat = (parserContext: ParserContext): Node =>
  binaryOp(parserContext, concat, (c) => skipValue(c, TOKEN_OPERATOR, '~'), parseRange);

const parseRange = (parserContext: ParserContext): Node =>
  binaryOp(parserContext, range, (c) => skipValue(c, TOKEN_OPERATOR, '..'), parseAdd);

export { parseConcat };
