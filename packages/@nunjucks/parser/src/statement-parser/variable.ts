import type { Token } from '@nunjucks/lexer';
import {
  TOKEN_OPERATOR,
  COMPOUND_ASSIGNMENT_OPS,
  isSymbolToken,
} from '@nunjucks/lexer';
import { compoundAssignment, variableAssignment, variableDeclaration } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipValue, nextToken, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parsePrimary, parseExpression } from "../expression-parser/index.ts";
import { tryParsePattern } from "../node-parser/pattern.ts";

export const parseVariableDeclaration = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);

  const patternNode = tryParsePattern(ctx);
  const target = patternNode ?? parsePrimary(ctx);
  if (!patternNode && (!target || (target.type !== 'symbol' && !target.value))) {
    fail(ctx, 'Expected variable name or pattern', tag.lineno, tag.colno);
  }
  const targets: Node[] = [target];

  if (!skipValue(ctx, TOKEN_OPERATOR, ':=')) {
    fail(ctx, 'Expected :=', tag.lineno, tag.colno);
  }

  const value = parseExpression(ctx);

  return variableDeclaration(tag.lineno, tag.colno, targets, value);
};

const parseOperator = (ctx: ParserContext, tag: Token): string => {
  const tok = peekToken(ctx);
  if (tok?.type === TOKEN_OPERATOR) {
    if (COMPOUND_ASSIGNMENT_OPS.includes(String(tok.value))) {
      const next = nextToken(ctx);
      return isSymbolToken(next) ? next.value : String(next.value);
    }
    if (tok.value === '=') {
      nextToken(ctx);
      return '=';
    }
    fail(ctx, 'Expected =, ||= , &&=, ??=, **=, //=', tag.lineno, tag.colno);
  }
  fail(ctx, 'Expected =', tag.lineno, tag.colno);
  return '';
};

export const parseVariableAssignment = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);

  const patternNode = tryParsePattern(ctx);
  const target = patternNode ?? parsePrimary(ctx);
  if (!patternNode && (!target || (target.type !== 'symbol' && !target.value))) {
    fail(ctx, 'Expected variable name or pattern', tag.lineno, tag.colno);
  }
  const targets: Node[] = [target];

  const operator = parseOperator(ctx, tag);
  const value = parseExpression(ctx);

  if (operator !== '=') {
    return compoundAssignment(tag.lineno, tag.colno, { targets, operator, value });
  }

  return variableAssignment(tag.lineno, tag.colno, targets, value);
};
