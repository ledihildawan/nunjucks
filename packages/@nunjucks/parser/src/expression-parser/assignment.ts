import type { Token } from '@nunjucks/lexer';
import { TOKEN_OPERATOR, TOKEN_PIPEFORWARD, COMPOUND_ASSIGNMENT_OPS } from '@nunjucks/lexer';
import {
  walrus,
  variableDeclaration,
  compoundAssignment,
  arrayPattern,
  objectPattern,
  patternProperty,
  restPattern,
  isArrayPattern,
  isArray,
  isObjectPattern,
  isDict,
  isPair,
  isSpread,
  isSymbol,
} from '@nunjucks/nodes';
import type { Node, SpreadNode } from '@nunjucks/nodes';
import { ERROR_DEFINITIONS } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import { peekToken, nextToken } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';
import { errorAt } from '../error.ts';
import { ok, isErr, type Result } from '@nunjucks/lib';
import { parseOr } from './logical.ts';
import { loc } from '@nunjucks/shared';

const mapArrayPatternChild = (c: Node): Node => {
  if (isPair(c) && isSymbol(c.value) && typeof c.key !== 'string' && c.key.value === c.value.value) {
    return c.value;
  }
  if (isSpread(c)) { return restPattern(loc(c), (c as SpreadNode).argument); }
  return c;
};

const mapObjectPatternChild = (c: Node): Node => {
  if (isPair(c) && typeof c.key !== 'string' && isSymbol(c.key) && isSymbol(c.value) && c.key.value === c.value.value) {
    return patternProperty(loc(c.key), { key: String(c.key.value), val: c.key });
  }
  if (isSpread(c)) { return restPattern(loc(c), (c as SpreadNode).argument); }
  return c;
};

const normalizePattern = (node: Node): Node => {
  if (isArrayPattern(node) || isObjectPattern(node)) { return node; }
  if (isArray(node)) {
    return arrayPattern(loc(node), (node as { children: readonly Node[] }).children.map(mapArrayPatternChild));
  }
  return objectPattern(loc(node), (node as { children: readonly Node[] }).children.map(mapObjectPatternChild));
};

const isExpressionContext = (tok: Token): boolean =>
  tok && (tok.type === 'operator' || tok.type === 'right-paren' || tok.type === 'comma');

const handleWalrusAssignment = (node: Node, valueNode: Node, isExprCtx: boolean): Result<Node, TemplateError> => {
  if (isSymbol(node)) {
    return ok(isExprCtx
      ? walrus(loc(node), { target: node, val: valueNode })
      : variableDeclaration(loc(node), { targets: [node], val: valueNode }));
  }
  if (isArrayPattern(node) || isArray(node) || isObjectPattern(node) || isDict(node)) {
    const pattern = normalizePattern(node);
    return ok(isExprCtx
      ? walrus(loc(pattern), { target: pattern, val: valueNode })
      : variableDeclaration(loc(pattern), { targets: [pattern], val: valueNode }));
  }
  return errorAt(node.lineno, node.colno, ERROR_DEFINITIONS.WALRUS_TARGET_INVALID);
};

const handleCompoundAssignment = (parserContext: ParserContext, node: Node, operator: string): Result<Node, TemplateError> => {
  const valueNodeR = parseOr(parserContext);
  if (isErr(valueNodeR)) { return valueNodeR; }
  if (isSymbol(node)) {
    return ok(compoundAssignment(loc(node), { targets: [node], operator, value: valueNodeR.value }));
  }
  return errorAt(node.lineno, node.colno, ERROR_DEFINITIONS.ASSIGNMENT_TARGET_INVALID);
};

const isCompoundAssignmentOp = (tok: Token): boolean =>
  (tok.type === TOKEN_OPERATOR && tok.value === '|>=') || COMPOUND_ASSIGNMENT_OPS.includes(String(tok.value));

const parseWalrusAssignment = (parserContext: ParserContext, node: Node): Result<Node, TemplateError> => {
  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) { return consumedR; }
  const valueNodeR = parseOr(parserContext);
  if (isErr(valueNodeR)) { return valueNodeR; }
  const afterTokR = peekToken(parserContext);
  if (isErr(afterTokR)) { return afterTokR; }
  const resultNodeR = handleWalrusAssignment(node, valueNodeR.value, isExpressionContext(afterTokR.value));
  if (isErr(resultNodeR)) { return resultNodeR; }
  return parseWalrus(parserContext, resultNodeR.value);
};

const parseWalrus = (parserContext: ParserContext, node: Node): Result<Node, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;
  if (tok.type !== TOKEN_OPERATOR && tok.type !== TOKEN_PIPEFORWARD) {
    return ok(node);
  }
  if (tok.value === ':=') {
    return parseWalrusAssignment(parserContext, node);
  }
  if (isCompoundAssignmentOp(tok)) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
    return handleCompoundAssignment(parserContext, node, String(tok.value));
  }
  return ok(node);
};

export { parseWalrus };
