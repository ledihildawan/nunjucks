import { add, sub, mul, div, floorDiv, mod, pow, concat, range } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { TOKEN_OPERATOR } from '@nunjucks/lexer';
import { skipValue } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';
import type { Result } from '@nunjucks/lib';
import { binaryOp, op } from './binary-helpers.ts';
import { parseUnary } from './primary.ts';

const parseAdd = (parserContext: ParserContext): Result<Node, TemplateError> => binaryOp(parserContext, add, op('+'), parseSub);
const parseSub = (parserContext: ParserContext): Result<Node, TemplateError> => binaryOp(parserContext, sub, op('-'), parseMul);
const parseMul = (parserContext: ParserContext): Result<Node, TemplateError> => binaryOp(parserContext, mul, op('*'), parseDiv);
const parseDiv = (parserContext: ParserContext): Result<Node, TemplateError> => binaryOp(parserContext, div, op('/'), parseFloorDiv);
const parseFloorDiv = (parserContext: ParserContext): Result<Node, TemplateError> => binaryOp(parserContext, floorDiv, op('//'), parseMod);
const parseMod = (parserContext: ParserContext): Result<Node, TemplateError> => binaryOp(parserContext, mod, op('%'), parsePow);
const parsePow = (parserContext: ParserContext): Result<Node, TemplateError> => binaryOp(parserContext, pow, op('**'), parseUnary);

const parseConcat = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, concat, (cursor) => skipValue(cursor, TOKEN_OPERATOR, '~'), parseRange);

const parseRange = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, range, (cursor) => skipValue(cursor, TOKEN_OPERATOR, '..'), parseAdd);

export { parseConcat };
