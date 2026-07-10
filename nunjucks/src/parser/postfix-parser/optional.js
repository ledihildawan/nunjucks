import { TOKEN_SYMBOL, TOKEN_LEFT_PAREN, TOKEN_RIGHT_PAREN, TOKEN_COMMA } from '../../lexer/token-types.js';
import { OptionalChain, OptionalCall, Literal, NodeList } from '../../nodes/index.js';
import { nextToken, peekToken, fail } from '../cursor.js';

const parseOptionalCallArgs = (ctx, tok) => {
  const args = NodeList(tok.lineno, tok.colno);
  let expectComma = false;

  while (true) {
    const next = peekToken(ctx);
    if (!next || next.type === TOKEN_RIGHT_PAREN) {
      if (next) {
        nextToken(ctx);
      }
      break;
    }

    if (expectComma) {
      if (next.type !== TOKEN_COMMA) {
        fail(ctx, 'expected comma after expression', next.lineno, next.colno);
      }
      nextToken(ctx);
    }

    const arg = ctx.parseExpression();
    args.addChild(arg);
    expectComma = true;
  }

  return args;
};

export const parseOptionalChain = (ctx, tok, target) => {
  nextToken(ctx);
  const val = peekToken(ctx);

  if (val && val.type === TOKEN_LEFT_PAREN) {
    nextToken(ctx);
    const args = parseOptionalCallArgs(ctx, tok);
    return OptionalCall(tok.lineno, tok.colno, target, args);
  }

  const val2 = nextToken(ctx);

  if (val2.type !== TOKEN_SYMBOL) {
    fail(ctx, 'expected name as lookup value, got ' + val2.value,
      val2.lineno,
      val2.colno);
  }

  const lookup = Literal(val2.lineno, val2.colno, val2.value);
  return OptionalChain(tok.lineno, tok.colno, target, lookup);
};
