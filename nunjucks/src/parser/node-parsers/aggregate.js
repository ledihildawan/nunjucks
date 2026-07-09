import * as lexer from '../../lexer/index.js';
import {
  Group,
  Array as ArrayNode,
  Dict,
  Pair,
} from '../../nodes.js';
import { nextToken, peekToken, skip, fail } from '../cursor.js';

export const parseAggregate = (ctx) => {
  const tok = nextToken(ctx);
  let node;

  switch (tok.type) {
    case lexer.TOKEN_LEFT_PAREN:
      node = new Group(tok.lineno, tok.colno);
      break;
    case lexer.TOKEN_LEFT_BRACKET:
      node = new ArrayNode(tok.lineno, tok.colno);
      break;
    case lexer.TOKEN_LEFT_CURLY:
      node = new Dict(tok.lineno, tok.colno);
      break;
    default:
      return null;
  }

  while (1) {
    const type = peekToken(ctx).type;
    if (type === lexer.TOKEN_RIGHT_PAREN ||
      type === lexer.TOKEN_RIGHT_BRACKET ||
      type === lexer.TOKEN_RIGHT_CURLY) {
      nextToken(ctx);
      break;
    }

    if (node.children.length > 0) {
      if (!skip(ctx, lexer.TOKEN_COMMA)) {
        fail(ctx, 'parseAggregate: expected comma after expression',
          tok.lineno,
          tok.colno);
      }
    }

    if (node instanceof Dict) {
      const key = ctx.parsePrimary();

      if (!skip(ctx, lexer.TOKEN_COLON)) {
        fail(ctx, 'parseAggregate: expected colon after dict key',
          tok.lineno,
          tok.colno);
      }

      const value = ctx.parseExpression();
      node.addChild(new Pair(key.lineno,
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
