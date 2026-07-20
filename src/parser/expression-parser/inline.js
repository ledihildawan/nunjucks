import { nodes } from '../../nodes/index.js';
import { skipSymbol, skipValue } from '../cursor.js';
import { parseOr } from './logical.js';
import { TOKEN_OPERATOR, TOKEN_COLON } from '../../lexer/token-types.js';

const parseTernary = (ctx, node) => {
  if (skipValue(ctx, TOKEN_OPERATOR, '?')) {
    const thenNode = parseOr(ctx);
    if (skipValue(ctx, TOKEN_COLON, ':')) {
      const elseNode = parseOr(ctx);
      const newNode = nodes.inlineIf(node.lineno, node.colno);
      newNode.cond = node;
      newNode.body = thenNode;
      newNode.else_ = elseNode;
      return parseTernary(ctx, newNode);
    }
  }
  return node;
};

const parseWalrus = (ctx, node) => {
  if (skipValue(ctx, TOKEN_OPERATOR, ':=')) {
    const valueNode = parseOr(ctx);
    let resultNode;
    if (nodes.isSymbol(node)) {
      resultNode = nodes.variableDeclaration(node.lineno, node.colno, [node], valueNode);
    } else if (nodes.isArrayPattern(node) || nodes.isArray(node)) {
      const pattern = nodes.isArrayPattern(node)
        ? node
        : nodes.arrayPattern(node.lineno, node.colno, node.children.map(c => {
            if (nodes.isPair(c) && nodes.isSymbol(c.value) && c.key.value === c.value.value) {
              return c.value;
            }
            if (nodes.isSpread(c)) {
              return nodes.restPattern(c.lineno, c.colno, c.argument);
            }
            return c;
          }));
      resultNode = nodes.variableDeclaration(node.lineno, node.colno, [pattern], valueNode);
    } else if (nodes.isObjectPattern(node) || nodes.isDict(node)) {
      let pattern;
      if (nodes.isObjectPattern(node)) {
        pattern = node;
      } else {
        pattern = nodes.objectPattern(node.lineno, node.colno, node.children.map(c => {
          if (nodes.isPair(c)) {
            if (nodes.isSymbol(c.key) && nodes.isSymbol(c.value) && c.key.value === c.value.value) {
              return nodes.patternProperty(c.key.lineno, c.key.colno, c.key.value, c.key);
            }
          } else if (nodes.isSpread(c)) {
            return nodes.restPattern(c.lineno, c.colno, c.argument);
          }
          return c;
        }));
      }
      resultNode = nodes.variableDeclaration(node.lineno, node.colno, [pattern], valueNode);
    } else {
      throw new Error('Walrus operator target must be a symbol or pattern');
    }
    return parseWalrus(ctx, resultNode);
  }

  return node;
};

export const parseInlineIf = (ctx) => {
  let node = parseOr(ctx);

  if (skipSymbol(ctx, 'if')) {
    const condNode = parseOr(ctx);
    const bodyNode = node;
    node = nodes.inlineIf(node.lineno, node.colno);
    node.body = bodyNode;
    node.cond = condNode;
    if (skipSymbol(ctx, 'else')) {
      node.else_ = parseOr(ctx);
    } else {
      node.else_ = null;
    }
    return node;
  }

  node = parseTernary(ctx, node);
  return parseWalrus(ctx, node);
};

export const parseExpression = (ctx) => parseInlineIf(ctx);
