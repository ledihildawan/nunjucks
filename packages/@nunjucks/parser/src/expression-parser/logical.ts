import { TOKEN_OPERATOR, TOKEN_COLON } from '@nunjucks/lexer';
import { nullishCoalesce, and, or, not, inlineIf } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import { peekToken, nextToken, skipSymbol, skipOperator, skipValue } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';
import { ok, isErr, type Result } from '@nunjucks/lib';
import { binaryOp } from './binary-helpers.ts';
import { parseIn } from './comparison.ts';
import { loc } from '@nunjucks/shared';

const parseNullishCoalesce = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, nullishCoalesce, (cursor) => skipValue(cursor, TOKEN_OPERATOR, '??'), parseAnd);

const parseNot = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;
  if (tok.type === TOKEN_OPERATOR && tok.value === '!') {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
    const innerR = parseNot(parserContext);
    if (isErr(innerR)) { return innerR; }
    return ok(not(loc(tok), innerR.value));
  }
  if (skipSymbol(parserContext, 'not')) {
    const innerR = parseNot(parserContext);
    if (isErr(innerR)) { return innerR; }
    return ok(not(loc(tok), innerR.value));
  }
  if (skipOperator(parserContext, '!')) {
    const innerR = parseNot(parserContext);
    if (isErr(innerR)) { return innerR; }
    return ok(not(loc(tok), innerR.value));
  }
  return parseIn(parserContext);
};

const parseAnd = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, and, (cursor) => skipSymbol(cursor, 'and') || skipOperator(cursor, '&&'), parseNot);

const parseOr = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, or, (cursor) => skipSymbol(cursor, 'or') || skipOperator(cursor, '||'), parseNullishCoalesce);

const parseTernary = (parserContext: ParserContext, node: Node): Result<Node, TemplateError> => {
  if (skipValue(parserContext, TOKEN_OPERATOR, '?')) {
    const thenR = parseOr(parserContext);
    if (isErr(thenR)) { return thenR; }
    if (skipValue(parserContext, TOKEN_COLON, ':')) {
      const elseR = parseOr(parserContext);
      if (isErr(elseR)) { return elseR; }
      const newNode = inlineIf(loc(node), { cond: node, body: thenR.value, alternate: elseR.value });
      return parseTernary(parserContext, newNode);
    }
  }
  return ok(node);
};

export { parseOr, parseTernary };
