import type { TemplateError } from '@nunjucks/error-formatter';
import { TOKEN_OPERATOR } from '@nunjucks/lexer';
import type { Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { add, concat, div, floorDiv, mod, mul, pow, range, sub } from '@nunjucks/nodes';
import type { ParserContext } from '../cursor.ts';
import { skipValue } from '../cursor.ts';
import { binaryOp, matchOperator } from './binary-helpers.ts';
import { parseUnary } from './primary.ts';

const parseAdd = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, { create: add, consume: matchOperator('+'), next: parseSub });
const parseSub = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, { create: sub, consume: matchOperator('-'), next: parseMul });
const parseMul = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, { create: mul, consume: matchOperator('*'), next: parseDiv });
const parseDiv = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, { create: div, consume: matchOperator('/'), next: parseFloorDiv });
const parseFloorDiv = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, { create: floorDiv, consume: matchOperator('//'), next: parseMod });
const parseMod = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, { create: mod, consume: matchOperator('%'), next: parsePow });
const parsePow = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, { create: pow, consume: matchOperator('**'), next: parseUnary });

/**
 * Parses `~` string concatenation, the loosest arithmetic level and the
 * arithmetic chain's entry point (`~` over `..` over `+ -` down to unary).
 */
const parseConcat = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, {
    create: concat,
    consume: (cursor) => skipValue(cursor, TOKEN_OPERATOR, '~'),
    next: parseRange,
  });

const parseRange = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, {
    create: range,
    consume: (cursor) => skipValue(cursor, TOKEN_OPERATOR, '..'),
    next: parseAdd,
  });

export { parseConcat };
