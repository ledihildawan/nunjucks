import {
  TOKEN_COLON,
  TOKEN_COMMA,
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_CURLY,
  TOKEN_LEFT_PAREN,
  TOKEN_RIGHT_BRACKET,
  TOKEN_RIGHT_CURLY,
  TOKEN_RIGHT_PAREN,
} from '../../lexer/token-types.js';
import {
  Group,
  ArrayNode,
  Dict,
  Pair,
  isDict,
} from '../../nodes/index.js';
import { nextToken, peekToken, skip, fail } from '../cursor.js';

export const parseAggregate = (ctx) => {
  const tok = nextToken(ctx);
  let node;

  switch (tok.type) {
    case TOKEN_LEFT_PAREN:
      node = Group(tok.lineno, tok.colno);
      break;
    case TOKEN_LEFT_BRACKET:
      node = ArrayNode(tok.lineno, tok.colno);
      break;
    case TOKEN_LEFT_CURLY:
      node = Dict(tok.lineno, tok.colno);
      break;
    default:
      return null;
  }

  while (1) {
    const type = peekToken(ctx).type;
    if (type === TOKEN_RIGHT_PAREN ||
      type === TOKEN_RIGHT_BRACKET ||
      type === TOKEN_RIGHT_CURLY) {
      nextToken(ctx);
      break;
    }

    if (node.children.length > 0) {
      if (!skip(ctx, TOKEN_COMMA)) {
        fail(ctx, 'parseAggregate: expected comma after expression',
          tok.lineno,
          tok.colno);
      }
    }

    if (isDict(node)) {
      const key = ctx.parsePrimary();

      if (!skip(ctx, TOKEN_COLON)) {
        fail(ctx, 'parseAggregate: expected colon after dict key',
          tok.lineno,
          tok.colno);
      }

      const value = ctx.parseExpression();
      node.addChild(Pair(key.lineno,
        key.colno,
        key,
        value));
    } else {
      const expr = ctx.parseExpression();
      node.addChild(expr);
    }
  }

  return node;
};
