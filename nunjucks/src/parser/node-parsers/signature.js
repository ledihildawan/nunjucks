import {
  TOKEN_BLOCK_END,
  TOKEN_COMMA,
  TOKEN_LEFT_PAREN,
  TOKEN_OPERATOR,
  TOKEN_RIGHT_PAREN,
} from '../../lexer/token-types.js';
import {
  NodeList,
  Pair,
  KeywordArgs,
} from '../../nodes/index.js';
import { nextToken, peekToken, skip, skipValue, fail } from '../cursor.js';

export const parseSignature = (ctx, tolerant, noParens) => {
  let tok = peekToken(ctx);
  if (!noParens && tok.type !== TOKEN_LEFT_PAREN) {
    if (tolerant) {
      return null;
    } else {
      fail(ctx, 'expected arguments', tok.lineno, tok.colno);
    }
  }

  if (tok.type === TOKEN_LEFT_PAREN) {
    tok = nextToken(ctx);
  }

  const args = NodeList(tok.lineno, tok.colno);
  const kwargs = KeywordArgs(tok.lineno, tok.colno);
  let checkComma = false;

  while (1) {
    tok = peekToken(ctx);
    if (!noParens && tok.type === TOKEN_RIGHT_PAREN) {
      nextToken(ctx);
      break;
    } else if (noParens && tok.type === TOKEN_BLOCK_END) {
      break;
    }

    if (checkComma && !skip(ctx, TOKEN_COMMA)) {
      fail(ctx, 'parseSignature: expected comma after expression',
        tok.lineno,
        tok.colno);
    } else {
      const arg = ctx.parseExpression();

      if (skipValue(ctx, TOKEN_OPERATOR, '=')) {
        kwargs.addChild(
          Pair(arg.lineno,
            arg.colno,
            arg,
            ctx.parseExpression())
        );
      } else {
        args.addChild(arg);
      }
    }

    checkComma = true;
  }

  if (kwargs.children.length) {
    args.addChild(kwargs);
  }

  return args;
};
