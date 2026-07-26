import { arrayPattern, compoundAssignment, inlineIf, isArray, isArrayPattern, isDict, isObjectPattern, isPair, isSpread, isSymbol, literal, objectPattern, patternProperty, restPattern, symbol, variableDeclaration, walrus } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { skipSymbol, skipValue, peekToken, nextToken } from "../cursor.ts";
import type { ParserContext, MutableNode } from "../cursor.ts";
import { parseOr } from "./logical.ts";
import { TOKEN_OPERATOR, TOKEN_PIPEFORWARD, TOKEN_COLON } from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';

type PairNode = Node & { key: Node; value: Node; argument: Node };

const _tokenToLiteral = (tok: Token): Node => {
  switch (tok.type) {
    case 'int':
      return literal(tok.lineno, tok.colno, Number(tok.value));
    case 'float':
      return literal(tok.lineno, tok.colno, Number.parseFloat(tok.value as string));
    case 'string':
      return literal(tok.lineno, tok.colno, tok.value);
    case 'boolean':
      return literal(tok.lineno, tok.colno, tok.value === 'true');
    case 'none':
      return literal(tok.lineno, tok.colno, null);
    default:
      return symbol(tok.lineno, tok.colno, tok.value as string);
  }
};

const parseTernary = (ctx: ParserContext, node: Node): Node => {
  if (skipValue(ctx, TOKEN_OPERATOR, '?')) {
    const thenNode = parseOr(ctx);
    if (skipValue(ctx, TOKEN_COLON, ':')) {
      const elseNode = parseOr(ctx);
      const newNode = inlineIf(node.lineno, node.colno);
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
  if (isArrayPattern(node) || isObjectPattern(node)) { return node; }
  if (isArray(node)) {
    return arrayPattern(node.lineno, node.colno, (node as MutableNode).children.map(c => {
      const p = c as PairNode;
      if (isPair(c) && isSymbol(p.value) && p.key.value === p.value.value) { return p.value; }
      if (isSpread(c)) { return restPattern(c.lineno, c.colno, p.argument); }
      return c;
    }));
  }
  return objectPattern(node.lineno, node.colno, (node as MutableNode).children.map(c => {
    const p = c as PairNode;
    if (isPair(c) && isSymbol(p.key) && isSymbol(p.value) && p.key.value === p.value.value) {
      return patternProperty(p.key.lineno, p.key.colno, p.key.value as Node, p.key);
    }
    if (isSpread(c)) { return restPattern(c.lineno, c.colno, p.argument); }
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
      if (isSymbol(node)) {
        if (isExpressionContext) {
          resultNode = walrus(node.lineno, node.colno, node, valueNode);
        } else {
          resultNode = variableDeclaration(node.lineno, node.colno, [node], valueNode);
        }
      } else if (isArrayPattern(node) || isArray(node) || isObjectPattern(node) || isDict(node)) {
        if (isExpressionContext) {
          resultNode = walrus(node.lineno, node.colno, normalizePattern(node), valueNode);
        } else {
          let pattern: Node = node;
          if (isArray(node)) {
            pattern = arrayPattern(node.lineno, node.colno, (node as MutableNode).children.map(c => {
              const p = c as PairNode;
              if (isPair(c) && isSymbol(p.value) && p.key.value === p.value.value) {
                return p.value;
              }
              if (isSpread(c)) {
                return restPattern(c.lineno, c.colno, p.argument);
              }
              return c;
            }));
          } else if (isDict(node)) {
            pattern = objectPattern(node.lineno, node.colno, (node as MutableNode).children.map(c => {
              const p = c as PairNode;
              if (isPair(c)) {
                if (isSymbol(p.key) && isSymbol(p.value) && p.key.value === p.value.value) {
                  return patternProperty(p.key.lineno, p.key.colno, p.key.value as Node, p.key);
                }
              } else if (isSpread(c)) {
                return restPattern(c.lineno, c.colno, p.argument);
              }
              return c;
            }));
          }
          resultNode = variableDeclaration(node.lineno, node.colno, [pattern], valueNode);
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
      if (isSymbol(node)) {
        return compoundAssignment(node.lineno, node.colno, [node], operator, valueNode);
      }
      throw new Error('Assignment target must be a symbol');
    }

    if (COMPOUND_OPS.includes(tok.value as string)) {
      const operator = tok.value as string;
      nextToken(ctx);
      const valueNode = parseOr(ctx);
      if (isSymbol(node)) {
        return compoundAssignment(node.lineno, node.colno, [node], operator, valueNode);
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
    node = inlineIf(node.lineno, node.colno);
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
