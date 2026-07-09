import * as lexer from '../../lexer/index.js';
import { OptionalChain, Literal } from '../../nodes.js';
import { nextToken, fail } from '../cursor.js';

export const parseOptionalChain = (ctx, tok, target) => {
  nextToken(ctx);
  const val = nextToken(ctx);

  if (val.type !== lexer.TOKEN_SYMBOL) {
    fail(ctx, 'expected name as lookup value, got ' + val.value,
      val.lineno,
      val.colno);
  }

  const lookup = new Literal(val.lineno, val.colno, val.value);
  return new OptionalChain(tok.lineno, tok.colno, target, lookup);
};
