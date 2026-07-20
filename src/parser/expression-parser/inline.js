import { nodes } from '../../nodes/index.js';
import { skipSymbol, skipValue, peekToken, nextToken } from '../cursor.js';
import { parseOr } from './logical.js';
import { TOKEN_OPERATOR, TOKEN_PIPEFORWARD, TOKEN_COLON, TOKEN_INT, TOKEN_FLOAT, TOKEN_STRING } from '../../lexer/token-types.js';

const tokenToLiteral = (tok) => {
  switch (tok.type) {
    case TOKEN_INT:
      return nodes.literal(tok.lineno, tok.colno, Number(tok.value));
    case TOKEN_FLOAT:
      return nodes.literal(tok.lineno, tok.colno, parseFloat(tok.value));
    case TOKEN_STRING:
      return nodes.literal(tok.lineno, tok.colno, tok.value);
    case 'boolean':
      return nodes.literal(tok.lineno, tok.colno, tok.value === 'true');
    case 'none':
      return nodes.literal(tok.lineno, tok.colno, null);
    default:
      return nodes.symbol(tok.lineno, tok.colno, tok.value);
  }
};

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

const COMPOUND_OPS = ['||=', '&&=', '??=', '**=', '//=', '+=', '-=', '*=', '/=', '%=', '|> ='];

const normalizePattern = (node) => {
  if (nodes.isArrayPattern(node) || nodes.isObjectPattern(node)) return node;
  if (nodes.isArray(node)) {
    return nodes.arrayPattern(node.lineno, node.colno, node.children.map(c => {
      if (nodes.isPair(c) && nodes.isSymbol(c.value) && c.key.value === c.value.value) return c.value;
      if (nodes.isSpread(c)) return nodes.restPattern(c.lineno, c.colno, c.argument);
      return c;
    }));
  }
  return nodes.objectPattern(node.lineno, node.colno, node.children.map(c => {
    if (nodes.isPair(c) && nodes.isSymbol(c.key) && nodes.isSymbol(c.value) && c.key.value === c.value.value) {
      return nodes.patternProperty(c.key.lineno, c.key.colno, c.key.value, c.key);
    }
    if (nodes.isSpread(c)) return nodes.restPattern(c.lineno, c.colno, c.argument);
    return c;
  }));
};

const parseWalrus = (ctx, node) => {
  const tok = peekToken(ctx);
  if (tok && (tok.type === TOKEN_OPERATOR || tok.type === TOKEN_PIPEFORWARD)) {
    if (tok.value === ':=') {
      nextToken(ctx);
      const valueNode = parseOr(ctx);
      const afterTok = peekToken(ctx);
      const isExpressionContext = afterTok && (
        afterTok.type === 'operator' ||
        afterTok.type === 'right-paren' ||
        afterTok.type === 'comma'
      );
      let resultNode;
      if (nodes.isSymbol(node)) {
        if (isExpressionContext) {
          resultNode = nodes.walrus(node.lineno, node.colno, node, valueNode);
        } else {
          resultNode = nodes.variableDeclaration(node.lineno, node.colno, [node], valueNode);
        }
      } else if (nodes.isArrayPattern(node) || nodes.isArray(node) || nodes.isObjectPattern(node) || nodes.isDict(node)) {
        if (isExpressionContext) {
          resultNode = nodes.walrus(node.lineno, node.colno, normalizePattern(node), valueNode);
        } else {
          let pattern = node;
          if (nodes.isArray(node)) {
            pattern = nodes.arrayPattern(node.lineno, node.colno, node.children.map(c => {
              if (nodes.isPair(c) && nodes.isSymbol(c.value) && c.key.value === c.value.value) {
                return c.value;
              }
              if (nodes.isSpread(c)) {
                return nodes.restPattern(c.lineno, c.colno, c.argument);
              }
              return c;
            }));
          } else if (nodes.isDict(node)) {
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
        }
      } else {
        throw new Error('Walrus operator target must be a symbol or pattern');
      }
      return parseWalrus(ctx, resultNode);
    }

    if (tok.type === TOKEN_OPERATOR && tok.value === '|>=') {
      const operator = tok.value;
      nextToken(ctx);
      const valueNode = parseOr(ctx);
      if (nodes.isSymbol(node)) {
        return nodes.compoundAssignment(node.lineno, node.colno, [node], operator, valueNode);
      }
      throw new Error('Assignment target must be a symbol');
    }

    if (COMPOUND_OPS.includes(tok.value)) {
      const operator = tok.value;
      nextToken(ctx);
      const valueNode = parseOr(ctx);
      if (nodes.isSymbol(node)) {
        return nodes.compoundAssignment(node.lineno, node.colno, [node], operator, valueNode);
      }
      throw new Error('Assignment target must be a symbol');
    }
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
