import { TOKEN_SYMBOL } from '../../lexer/token-types.js';
import { LookupVal, Literal } from '../../nodes/index.js';
import { nextToken, fail } from '../cursor.js';

export const parseDotAccess = (ctx, tok, target) => {
  nextToken(ctx);
  const val = nextToken(ctx);

  if (val.type !== TOKEN_SYMBOL) {
    fail(ctx, 'expected name as lookup value, got ' + val.value,
      val.lineno,
      val.colno);
  }

  const lookup = new Literal(val.lineno, val.colno, val.value);
  return new LookupVal(tok.lineno, tok.colno, target, lookup);
};
