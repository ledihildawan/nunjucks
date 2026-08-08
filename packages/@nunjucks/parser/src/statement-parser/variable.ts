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
import { loc } from '@nunjucks/shared';

export const parseVariableDeclaration = (parserContext: ParserContext): Node => {
  const tag = peekToken(parserContext);

  const patternNode = tryParsePattern(parserContext);
  const target = patternNode ?? parsePrimary(parserContext);
  if (!patternNode && (!target || (target.type !== 'symbol' && !target.value))) {
    fail(parserContext, 'Expected variable name or pattern', tag.lineno, tag.colno);
  }
  const targets: Node[] = [target];

  if (!skipValue(parserContext, TOKEN_OPERATOR, ':=')) {
    fail(parserContext, 'Expected :=', tag.lineno, tag.colno);
  }

  const value = parseExpression(parserContext);

  return variableDeclaration(loc(tag), { targets, val: value });
};

const parseOperator = (parserContext: ParserContext, tag: Token): string => {
  const tok = peekToken(parserContext);
  if (tok?.type === TOKEN_OPERATOR) {
    if (COMPOUND_ASSIGNMENT_OPS.includes(String(tok.value))) {
      const next = nextToken(parserContext);
      return isSymbolToken(next) ? next.value : String(next.value);
    }
    if (tok.value === '=') {
      nextToken(parserContext);
      return '=';
    }
    fail(parserContext, 'Expected =, ||= , &&=, ??=, **=, //=', tag.lineno, tag.colno);
  }
  fail(parserContext, 'Expected =', tag.lineno, tag.colno);
  return '';
};

export const parseVariableAssignment = (parserContext: ParserContext): Node => {
  const tag = peekToken(parserContext);

  const patternNode = tryParsePattern(parserContext);
  const target = patternNode ?? parsePrimary(parserContext);
  if (!patternNode && (!target || (target.type !== 'symbol' && !target.value))) {
    fail(parserContext, 'Expected variable name or pattern', tag.lineno, tag.colno);
  }
  const targets: Node[] = [target];

  const operator = parseOperator(parserContext, tag);
  const value = parseExpression(parserContext);

  if (operator !== '=') {
    return compoundAssignment(loc(tag), { targets, operator, value });
  }

  return variableAssignment(loc(tag), { targets, val: value });
};
