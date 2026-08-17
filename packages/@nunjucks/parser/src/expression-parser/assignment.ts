import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import type { Token } from '@nunjucks/lexer';
import {
  COMPOUND_ASSIGNMENT_OPS,
  TOKEN_COMMA,
  TOKEN_OPERATOR,
  TOKEN_PIPEFORWARD,
  TOKEN_RIGHT_PAREN,
} from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import {
  arrayPattern,
  compoundAssignment,
  isArray,
  isArrayPattern,
  isDict,
  isObjectPattern,
  isPair,
  isSpread,
  isSymbol,
  objectPattern,
  patternProperty,
  restPattern,
  variableDeclaration,
  walrus,
} from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { nextToken, peekToken } from '../cursor.ts';
import { errorAt } from '../error.ts';
import { parseOr } from './logical.ts';

const mapArrayPatternChild = (c: Node): Node => {
  if (
    isPair(c) &&
    isSymbol(c.value) &&
    typeof c.key !== 'string' &&
    c.key.value === c.value.value
  ) {
    return c.value;
  }
  if (isSpread(c)) {
    return restPattern(loc(c), c.argument);
  }
  return c;
};

const mapObjectPatternChild = (c: Node): Node => {
  if (
    isPair(c) &&
    typeof c.key !== 'string' &&
    isSymbol(c.key) &&
    isSymbol(c.value) &&
    c.key.value === c.value.value
  ) {
    return patternProperty(loc(c.key), { key: String(c.key.value), val: c.key });
  }
  if (isSpread(c)) {
    return restPattern(loc(c), c.argument);
  }
  return c;
};

const normalizePattern = (node: Node): Node => {
  if (isArrayPattern(node) || isObjectPattern(node)) {
    return node;
  }
  if (isArray(node)) {
    return arrayPattern(loc(node), (node.children ?? []).map(mapArrayPatternChild));
  }
  return objectPattern(loc(node), (node.children ?? []).map(mapObjectPatternChild));
};

const isExpressionContext = (tok: Token): boolean =>
  tok &&
  (tok.type === TOKEN_OPERATOR || tok.type === TOKEN_RIGHT_PAREN || tok.type === TOKEN_COMMA);

const handleWalrusAssignment = (
  node: Node,
  valueNode: Node,
  isExprCtx: boolean
): Result<Node, TemplateError> => {
  if (isSymbol(node)) {
    return ok(
      isExprCtx
        ? walrus(loc(node), { target: node, val: valueNode })
        : variableDeclaration(loc(node), { targets: [node], val: valueNode })
    );
  }
  if (isArrayPattern(node) || isArray(node) || isObjectPattern(node) || isDict(node)) {
    const pattern = normalizePattern(node);
    return ok(
      isExprCtx
        ? walrus(loc(pattern), { target: pattern, val: valueNode })
        : variableDeclaration(loc(pattern), { targets: [pattern], val: valueNode })
    );
  }
  return errorAt({
    lineno: node.lineno,
    colno: node.colno,
    errorDef: ERROR_DEFINITIONS.WALRUS_TARGET_INVALID,
  });
};

const handleCompoundAssignment = (
  parserContext: ParserContext,
  node: Node,
  operator: string
): Result<Node, TemplateError> => {
  const valueNodeR = parseOr(parserContext);
  if (isErr(valueNodeR)) {
    return valueNodeR;
  }
  if (isSymbol(node)) {
    return ok(
      compoundAssignment(loc(node), { targets: [node], operator, value: valueNodeR.value })
    );
  }
  return errorAt({
    lineno: node.lineno,
    colno: node.colno,
    errorDef: ERROR_DEFINITIONS.ASSIGNMENT_TARGET_INVALID,
  });
};

const isCompoundAssignmentOp = (tok: Token): boolean =>
  (tok.type === TOKEN_OPERATOR && tok.value === '|>=') ||
  COMPOUND_ASSIGNMENT_OPS.includes(String(tok.value));

const parseWalrusAssignment = (
  parserContext: ParserContext,
  node: Node
): Result<Node, TemplateError> => {
  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) {
    return consumedR;
  }
  const valueNodeR = parseOr(parserContext);
  if (isErr(valueNodeR)) {
    return valueNodeR;
  }
  const afterTokR = peekToken(parserContext);
  if (isErr(afterTokR)) {
    return afterTokR;
  }
  const resultNodeR = handleWalrusAssignment(
    node,
    valueNodeR.value,
    isExpressionContext(afterTokR.value)
  );
  if (isErr(resultNodeR)) {
    return resultNodeR;
  }
  return parseWalrus(parserContext, resultNodeR.value);
};

const parseWalrus = (parserContext: ParserContext, node: Node): Result<Node, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;
  if (tok.type !== TOKEN_OPERATOR && tok.type !== TOKEN_PIPEFORWARD) {
    return ok(node);
  }
  if (tok.value === ':=') {
    return parseWalrusAssignment(parserContext, node);
  }
  if (isCompoundAssignmentOp(tok)) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
    return handleCompoundAssignment(parserContext, node, String(tok.value));
  }
  return ok(node);
};

export { parseWalrus };
