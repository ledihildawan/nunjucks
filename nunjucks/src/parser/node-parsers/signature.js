import * as lexer from '../../lexer/index.js';
import {
  NodeList,
  Pair,
  KeywordArgs,
} from '../../nodes.js';
import { nextToken, peekToken, skip, skipValue, fail } from '../cursor.js';

export const parseSignature = (ctx, tolerant, noParens) => {
  let tok = peekToken(ctx);
  if (!noParens && tok.type !== lexer.TOKEN_LEFT_PAREN) {
    if (tolerant) {
      return null;
    } else {
      fail(ctx, 'expected arguments', tok.lineno, tok.colno);
    }
  }

  if (tok.type === lexer.TOKEN_LEFT_PAREN) {
    tok = nextToken(ctx);
  }

  const args = new NodeList(tok.lineno, tok.colno);
  const kwargs = new KeywordArgs(tok.lineno, tok.colno);
  let checkComma = false;

  while (1) {
    tok = peekToken(ctx);
    if (!noParens && tok.type === lexer.TOKEN_RIGHT_PAREN) {
      nextToken(ctx);
      break;
    } else if (noParens && tok.type === lexer.TOKEN_BLOCK_END) {
      break;
    }

    if (checkComma && !skip(ctx, lexer.TOKEN_COMMA)) {
      fail(ctx, 'parseSignature: expected comma after expression',
        tok.lineno,
        tok.colno);
    } else {
      const arg = ctx.parseExpression();

      if (skipValue(ctx, lexer.TOKEN_OPERATOR, '=')) {
        kwargs.addChild(
          new Pair(arg.lineno,
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
