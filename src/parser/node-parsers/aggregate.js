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
} from '../../lexer/token-types.js';
import {
  nodes,
} from '../../nodes/index.js';
import { nextToken, peekToken, skip, skipValue, fail } from '../cursor.js';

export const parseAggregate = (ctx) => {
  const tok = nextToken(ctx);
  let node;

  switch (tok.type) {
    case TOKEN_LEFT_PAREN:
      node = nodes.group(tok.lineno, tok.colno);
      break;
    case TOKEN_LEFT_BRACKET:
      node = nodes.array(tok.lineno, tok.colno);
      break;
    case TOKEN_LEFT_CURLY:
      node = nodes.dict(tok.lineno, tok.colno);
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
      if (!skip(ctx, TOKEN_COMMA)) {
        fail(ctx, 'parseAggregate: expected comma after expression',
          next.lineno,
          next.colno);
      }
      const afterComma = peekToken(ctx).type;
      if (afterComma === TOKEN_COMMA || afterComma === TOKEN_RIGHT_BRACKET || afterComma === TOKEN_RIGHT_PAREN) {
        node.addChild(nodes.hole(tok.lineno, tok.colno));
        if (afterComma === TOKEN_RIGHT_BRACKET || afterComma === TOKEN_RIGHT_PAREN) {
          nextToken(ctx);
          break;
        }
        continue;
      }
    }

    if (nodes.isDict(node)) {
      if (peekToken(ctx).type === TOKEN_SPREAD) {
        nextToken(ctx);
        const arg = ctx.parseExpression();
        node.addChild(nodes.spread(tok.lineno, tok.colno, arg));
      } else {
        const key = ctx.parsePrimary();

        if (!skip(ctx, TOKEN_COLON)) {
          const next = peekToken(ctx);
          if (next && (next.type === TOKEN_COMMA || next.type === TOKEN_RIGHT_CURLY)) {
            const value = nodes.symbol(key.lineno, key.colno, key.value);
            node.addChild(nodes.pair(key.lineno, key.colno, key, value));
          } else if (next && next.type === TOKEN_OPERATOR && next.value === '=') {
            nextToken(ctx);
            const defaultVal = ctx.parseExpression();
            const value = nodes.symbol(key.lineno, key.colno, key.value);
            const defaultPattern = nodes.assignmentPattern(key.lineno, key.colno, value, defaultVal);
            node.addChild(nodes.pair(key.lineno, key.colno, key, defaultPattern));
          } else {
            fail(ctx, 'parseAggregate: expected colon after dict key',
              next?.lineno ?? tok.lineno,
              next?.colno ?? tok.colno);
          }
        } else {
          const value = ctx.parseExpression();
          node.addChild(nodes.pair(key.lineno, key.colno, key, value));
        }
      }
    } else {
      if (peekToken(ctx).type === TOKEN_SPREAD) {
        nextToken(ctx);
        const arg = ctx.parseExpression();
        node.addChild(nodes.spread(tok.lineno, tok.colno, arg));
      } else {
        const expr = ctx.parseExpression();
        if (skipValue(ctx, TOKEN_OPERATOR, '=')) {
          const defaultVal = ctx.parseExpression();
          node.addChild(nodes.assignmentPattern(expr.lineno, expr.colno, expr, defaultVal));
        } else {
          node.addChild(expr);
        }
      }
    }
  }

  return node;
};
