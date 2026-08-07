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
import type { Node } from '@nunjucks/nodes';
import { ERROR_DEFINITIONS } from '@nunjucks/log';
import { peekToken, nextToken } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';
import { errorAt } from '../error.ts';
import { parseOr } from './logical.ts';

type PairNode = Node & { key: Node; value: Node; argument: Node };

const normalizePattern = (node: Node): Node => {
  if (isArrayPattern(node) || isObjectPattern(node)) { return node; }
  if (isArray(node)) {
    return arrayPattern(node.lineno, node.colno, (node as { children: readonly Node[] }).children.map((c: Node) => {
      const p = c as PairNode;
      if (isPair(c) && isSymbol(p.value) && p.key.value === p.value.value) { return p.value; }
      if (isSpread(c)) { return restPattern(c.lineno, c.colno, p.argument); }
      return c;
    }));
  }
  return objectPattern(node.lineno, node.colno, (node as { children: readonly Node[] }).children.map((c: Node) => {
    const p = c as PairNode;
    if (isPair(c) && isSymbol(p.key) && isSymbol(p.value) && p.key.value === p.value.value) {
      return patternProperty(p.key.lineno, p.key.colno, String(p.key.value), p.key);
    }
    if (isSpread(c)) { return restPattern(p.lineno, p.colno, p.argument); }
    return c;
  }));
};

const isExpressionContext = (tok: Token): boolean =>
  tok && (tok.type === 'operator' || tok.type === 'right-paren' || tok.type === 'comma');

const handleWalrusAssignment = (node: Node, valueNode: Node, isExprCtx: boolean): Node => {
  if (isSymbol(node)) {
    return isExprCtx
      ? walrus(node.lineno, node.colno, node, valueNode)
      : variableDeclaration(node.lineno, node.colno, [node], valueNode);
  }
  if (isArrayPattern(node) || isArray(node) || isObjectPattern(node) || isDict(node)) {
    const pattern = normalizePattern(node);
    return isExprCtx
      ? walrus(pattern.lineno, pattern.colno, pattern, valueNode)
      : variableDeclaration(pattern.lineno, pattern.colno, [pattern], valueNode);
  }
  throw errorAt(node.lineno, node.colno, ERROR_DEFINITIONS.WALRUS_TARGET_INVALID);
};

const handleCompoundAssignment = (parserContext: ParserContext, node: Node, operator: string): Node => {
  const valueNode = parseOr(parserContext);
  if (isSymbol(node)) {
    return compoundAssignment(node.lineno, node.colno, { targets: [node], operator, value: valueNode });
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
