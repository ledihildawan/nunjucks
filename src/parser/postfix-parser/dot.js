import { TOKEN_SYMBOL } from '../../lexer/token-types.js';
import { LookupVal, Literal } from '../../nodes/index.js';
import { nextToken, fail } from '../cursor.js';

export const parseDotAccess = (ctx, tok, target) => {
  nextToken(ctx);
  const val = nextToken(ctx);

  if (val.type !== TOKEN_SYMBOL) {
    const targetName = target?.name || 'expression';
    fail(ctx, 'expected name as lookup value after dot on ' + targetName + ', got ' + val.value,
      val.lineno,
      val.colno);
  }

  const lookup = Literal(val.lineno, val.colno, val.value);
  const node = LookupVal(tok.lineno, tok.colno, target, lookup);
  node.isBracketNotation = false;
  return node;
};
