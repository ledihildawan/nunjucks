import { nodes } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { skipSymbol, skipValue, peekToken, nextToken } from "../cursor.ts";
import type { ParserContext, MutableNode } from "../cursor.ts";
import { parseOr } from "./logical.ts";
import { TOKEN_OPERATOR, TOKEN_PIPEFORWARD, TOKEN_COLON } from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';

type PairNode = Node & { key: Node; value: Node; argument: Node };

const tokenToLiteral = (tok: Token): Node => {
  switch (tok.type) {
    case 'int':
      return nodes.literal(tok.lineno, tok.colno, Number(tok.value));
    case 'float':
      return nodes.literal(tok.lineno, tok.colno, parseFloat(tok.value as string));
    case 'string':
      return nodes.literal(tok.lineno, tok.colno, tok.value);
    case 'boolean':
      return nodes.literal(tok.lineno, tok.colno, tok.value === 'true');
    case 'none':
      return nodes.literal(tok.lineno, tok.colno, null);
    default:
      return nodes.symbol(tok.lineno, tok.colno, tok.value as string);
  }
};

const parseTernary = (ctx: ParserContext, node: Node): Node => {
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

const normalizePattern = (node: Node): Node => {
  if (nodes.isArrayPattern(node) || nodes.isObjectPattern(node)) return node;
  if (nodes.isArray(node)) {
    return nodes.arrayPattern(node.lineno, node.colno, (node as MutableNode).children.map(c => {
      const p = c as PairNode;
      if (nodes.isPair(c) && nodes.isSymbol(p.value) && p.key.value === p.value.value) return p.value;
      if (nodes.isSpread(c)) return nodes.restPattern(c.lineno, c.colno, p.argument);
      return c;
    }));
  }
  return nodes.objectPattern(node.lineno, node.colno, (node as MutableNode).children.map(c => {
    const p = c as PairNode;
    if (nodes.isPair(c) && nodes.isSymbol(p.key) && nodes.isSymbol(p.value) && p.key.value === p.value.value) {
      return nodes.patternProperty(p.key.lineno, p.key.colno, p.key.value as Node, p.key);
    }
    if (nodes.isSpread(c)) return nodes.restPattern(c.lineno, c.colno, p.argument);
    return c;
  }));
};

const parseWalrus = (ctx: ParserContext, node: Node): Node => {
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
      let resultNode: Node;
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
            pattern = nodes.arrayPattern(node.lineno, node.colno, (node as MutableNode).children.map(c => {
              const p = c as PairNode;
              if (nodes.isPair(c) && nodes.isSymbol(p.value) && p.key.value === p.value.value) {
                return p.value;
              }
              if (nodes.isSpread(c)) {
                return nodes.restPattern(c.lineno, c.colno, p.argument);
              }
              return c;
            }));
          } else if (nodes.isDict(node)) {
            pattern = nodes.objectPattern(node.lineno, node.colno, (node as MutableNode).children.map(c => {
              const p = c as PairNode;
              if (nodes.isPair(c)) {
                if (nodes.isSymbol(p.key) && nodes.isSymbol(p.value) && p.key.value === p.value.value) {
                  return nodes.patternProperty(p.key.lineno, p.key.colno, p.key.value as Node, p.key);
                }
              } else if (nodes.isSpread(c)) {
                return nodes.restPattern(c.lineno, c.colno, p.argument);
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
      const operator = tok.value as string;
      nextToken(ctx);
      const valueNode = parseOr(ctx);
      if (nodes.isSymbol(node)) {
        return nodes.compoundAssignment(node.lineno, node.colno, [node], operator, valueNode);
      }
      throw new Error('Assignment target must be a symbol');
    }

    if (COMPOUND_OPS.includes(tok.value as string)) {
      const operator = tok.value as string;
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

export const parseInlineIf = (ctx: ParserContext): Node => {
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

export const parseExpression = (ctx: ParserContext): Node => parseInlineIf(ctx);
