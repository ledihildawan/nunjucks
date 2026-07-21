import { TOKEN_SYMBOL } from '@nunjucks/lexer';
import { nodes } from '@nunjucks/nodes';
import { nextToken, fail } from "../cursor.ts";
import { BracketNotation } from "./lookup.ts";

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
