import {
  TOKEN_COLON,
  TOKEN_COMMA,
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_CURLY,
  TOKEN_LEFT_PAREN,
  TOKEN_OPERATOR,
  TOKEN_RIGHT_BRACKET,
  TOKEN_RIGHT_CURLY,
  TOKEN_RIGHT_PAREN,
  TOKEN_SPREAD,
  TOKEN_SYMBOL,
} from '@nunjucks/lexer';
import { appendChild, array, assignmentPattern, dict, group, hole, isDict, pair, spread, symbol } from '@nunjucks/nodes';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import { nextToken, peekToken, skip, skipValue, fail, EXPECTED_COLON_AFTER_DICT_KEY } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression, parsePrimary } from "../expression-parser/index.ts";

export const parseAggregate = (ctx: ParserContext): Node | null => {
  const tok = nextToken(ctx);
  let node: ChildrenNode;

  switch (tok.type) {
    case TOKEN_LEFT_PAREN:
      node = group(tok.lineno, tok.colno);
      break;
    case TOKEN_LEFT_BRACKET:
      node = array(tok.lineno, tok.colno);
      break;
    case TOKEN_LEFT_CURLY:
      node = dict(tok.lineno, tok.colno);
      break;
    default:
      return null;
  }

  while (true) {
    const type = peekToken(ctx).type;
    if (type === TOKEN_RIGHT_PAREN ||
      type === TOKEN_RIGHT_BRACKET ||
      type === TOKEN_RIGHT_CURLY) {
      nextToken(ctx);
      break;
    }

    if (node.children.length > 0) {
      const next = peekToken(ctx) || tok;
      if (skip(ctx, TOKEN_COMMA)) {
        const afterComma = peekToken(ctx).type;
        if (afterComma === TOKEN_COMMA || afterComma === TOKEN_RIGHT_BRACKET || afterComma === TOKEN_RIGHT_PAREN) {
          node = appendChild(node, hole(tok.lineno, tok.colno));
          if (afterComma === TOKEN_RIGHT_BRACKET || afterComma === TOKEN_RIGHT_PAREN) {
            nextToken(ctx);
            break;
          }
          continue;
        }
      } else if (next.type === TOKEN_SYMBOL || next.type === TOKEN_LEFT_BRACKET || next.type === TOKEN_LEFT_CURLY || next.type === TOKEN_LEFT_PAREN) {
        } else {
          fail(ctx, 'parseAggregate: expected comma after expression',
            next.lineno,
            next.colno);
        }
    }

    if (isDict(node)) {
      if (peekToken(ctx).type === TOKEN_SPREAD) {
        nextToken(ctx);
        const arg = parseExpression(ctx);
        node = appendChild(node, spread(tok.lineno, tok.colno, arg));
      } else {
        const key = parsePrimary(ctx);

        if (skip(ctx, TOKEN_COLON)) {
          const value = parseExpression(ctx);
          node = appendChild(node, pair(key.lineno, key.colno, key, value));
        } else {
          const next = peekToken(ctx);
          if (next && (next.type === TOKEN_COMMA || next.type === TOKEN_RIGHT_CURLY)) {
            const value = symbol(key.lineno, key.colno, key.value as string);
            node = appendChild(node, pair(key.lineno, key.colno, key, value));
          } else if (next && next.type === TOKEN_OPERATOR && next.value === '=') {
            nextToken(ctx);
            const defaultVal = parseExpression(ctx);
            const value = symbol(key.lineno, key.colno, key.value as string);
            const defaultPattern = assignmentPattern(key.lineno, key.colno, value, defaultVal);
            node = appendChild(node, pair(key.lineno, key.colno, key, defaultPattern));
          } else {
            fail(ctx, 'parseAggregate: expected colon after dict key',
              next?.lineno ?? tok.lineno,
              next?.colno ?? tok.colno,
              EXPECTED_COLON_AFTER_DICT_KEY);
          }
        }
      }
    } else if (peekToken(ctx).type === TOKEN_SPREAD) {
        nextToken(ctx);
        const arg = parseExpression(ctx);
        node = appendChild(node, spread(tok.lineno, tok.colno, arg));
      } else {
        const expr = parseExpression(ctx);
        if (skipValue(ctx, TOKEN_OPERATOR, '=')) {
          const defaultVal = parseExpression(ctx);
          node = appendChild(node, assignmentPattern(expr.lineno, expr.colno, expr, defaultVal));
        } else {
          node = appendChild(node, expr);
        }
      }
  }

  return node;
};
