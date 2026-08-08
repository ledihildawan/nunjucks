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
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { peekToken, nextToken } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';
import { errorAt } from '../error.ts';
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

const handleWalrusAssignment = (node: Node, valueNode: Node, isExprCtx: boolean): Node => {
  if (isSymbol(node)) {
    return isExprCtx
      ? walrus(loc(node), { target: node, val: valueNode })
      : variableDeclaration(loc(node), { targets: [node], val: valueNode });
  }
  if (isArrayPattern(node) || isArray(node) || isObjectPattern(node) || isDict(node)) {
    const pattern = normalizePattern(node);
    return isExprCtx
      ? walrus(loc(pattern), { target: pattern, val: valueNode })
      : variableDeclaration(loc(pattern), { targets: [pattern], val: valueNode });
  }
  throw errorAt(node.lineno, node.colno, ERROR_DEFINITIONS.WALRUS_TARGET_INVALID);
};

const handleCompoundAssignment = (parserContext: ParserContext, node: Node, operator: string): Node => {
  const valueNode = parseOr(parserContext);
  if (isSymbol(node)) {
    return compoundAssignment(loc(node), { targets: [node], operator, value: valueNode });
  }
  throw errorAt(node.lineno, node.colno, ERROR_DEFINITIONS.ASSIGNMENT_TARGET_INVALID);
};

const parseWalrus = (parserContext: ParserContext, node: Node): Node => {
  const tok = peekToken(parserContext);
  if (tok && (tok.type === TOKEN_OPERATOR || tok.type === TOKEN_PIPEFORWARD)) {
    if (tok.value === ':=') {
      nextToken(parserContext);
      const valueNode = parseOr(parserContext);
      const afterTok = peekToken(parserContext);
      const resultNode = handleWalrusAssignment(node, valueNode, isExpressionContext(afterTok));
      return parseWalrus(parserContext, resultNode);
    }

    if (tok.type === TOKEN_OPERATOR && tok.value === '|>=') {
      nextToken(parserContext);
      return handleCompoundAssignment(parserContext, node, tok.value);
    }

    if (COMPOUND_ASSIGNMENT_OPS.includes(String(tok.value))) {
      nextToken(parserContext);
      return handleCompoundAssignment(parserContext, node, String(tok.value));
    }
  }

  return node;
};

export { parseWalrus };
