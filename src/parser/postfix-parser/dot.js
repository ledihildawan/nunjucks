import { TOKEN_SYMBOL } from '../../lexer/token-types.js';
import { nodes } from '../../nodes/index.js';
import { nextToken, fail } from '../cursor.js';
import { BracketNotation } from './lookup.js';

export const parseDotAccess = (ctx, tok, target) => {
  nextToken(ctx);
  const val = nextToken(ctx);

  if (val.type !== TOKEN_SYMBOL) {
    const targetName = target?.name || 'expression';
    fail(ctx, 'expected name as lookup value after dot on ' + targetName + ', got ' + val.value,
      val.lineno,
      val.colno);
  }

  const lookup = nodes.literal(val.lineno, val.colno, val.value);
  const node = nodes.lookupVal(tok.lineno, tok.colno, target, lookup);
  node[BracketNotation] = false;
  return node;
};
