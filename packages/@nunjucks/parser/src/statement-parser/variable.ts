import type { Token } from '@nunjucks/lexer';
import {
  TOKEN_OPERATOR,
  COMPOUND_ASSIGNMENT_OPS,
  isSymbolToken,
} from '@nunjucks/lexer';
import { compoundAssignment, variableAssignment, variableDeclaration } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import { peekToken, skipValue, nextToken, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/shared';
import { parsePrimary, parseExpression } from "../expression-parser/index.ts";
import { tryParsePattern } from "../node-parser/pattern.ts";
import { loc } from '@nunjucks/shared';

export const parseVariableDeclaration = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) { return tagR; }
  const tag = tagR.value;

  const patternNodeR = tryParsePattern(parserContext);
  if (isErr(patternNodeR)) { return patternNodeR; }
  const patternNode = patternNodeR.value;
  let target: Node;
  if (patternNode) {
    target = patternNode;
  } else {
    const primR = parsePrimary(parserContext);
    if (isErr(primR)) { return primR; }
    target = primR.value;
  }
  if (!patternNode && (!target || (target.type !== 'symbol' && !target.value))) {
    return fail(parserContext, 'Expected variable name or pattern', tag.lineno, tag.colno);
  }
  const targets: Node[] = [target];

  if (!skipValue(parserContext, TOKEN_OPERATOR, ':=')) {
    return fail(parserContext, 'Expected :=', tag.lineno, tag.colno);
  }

  const valueR = parseExpression(parserContext);
  if (isErr(valueR)) { return valueR; }

  return ok(variableDeclaration(loc(tag), { targets, val: valueR.value }));
};

const parseOperator = (parserContext: ParserContext, tag: Token): Result<string, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;
  if (tok?.type === TOKEN_OPERATOR) {
    if (COMPOUND_ASSIGNMENT_OPS.includes(String(tok.value))) {
      const nextR = nextToken(parserContext);
      if (isErr(nextR)) { return nextR; }
      return ok(isSymbolToken(nextR.value) ? nextR.value.value : String(nextR.value.value));
    }
    if (tok.value === '=') {
      const consumedR = nextToken(parserContext);
      if (isErr(consumedR)) { return consumedR; }
      return ok('=');
    }
    return fail(parserContext, 'Expected =, ||= , &&=, ??=, **=, //=', tag.lineno, tag.colno);
  }
  return fail(parserContext, 'Expected =', tag.lineno, tag.colno);
};

export const parseVariableAssignment = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) { return tagR; }
  const tag = tagR.value;

  const patternNodeR = tryParsePattern(parserContext);
  if (isErr(patternNodeR)) { return patternNodeR; }
  const patternNode = patternNodeR.value;
  let target: Node;
  if (patternNode) {
    target = patternNode;
  } else {
    const primR = parsePrimary(parserContext);
    if (isErr(primR)) { return primR; }
    target = primR.value;
  }
  if (!patternNode && (!target || (target.type !== 'symbol' && !target.value))) {
    return fail(parserContext, 'Expected variable name or pattern', tag.lineno, tag.colno);
  }
  const targets: Node[] = [target];

  const operatorR = parseOperator(parserContext, tag);
  if (isErr(operatorR)) { return operatorR; }
  const operator = operatorR.value;
  const valueR = parseExpression(parserContext);
  if (isErr(valueR)) { return valueR; }

  if (operator !== '=') {
    return ok(compoundAssignment(loc(tag), { targets, operator, value: valueR.value }));
  }

  return ok(variableAssignment(loc(tag), { targets, val: valueR.value }));
};
