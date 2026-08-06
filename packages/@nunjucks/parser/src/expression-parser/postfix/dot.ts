import { TOKEN_SYMBOL } from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import { literal, lookupVal } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { nextToken, fail } from "../../cursor.ts";
import type { ParserContext } from "../../cursor.ts";
import { markBracketNotation } from "./lookup.ts";

export const parseDotAccess = (ctx: ParserContext, tok: Token, target: Node): Node => {
  nextToken(ctx);
  const val = nextToken(ctx);

  if (val.type !== TOKEN_SYMBOL) {
    const targetName = (target ? String(target.value ?? 'expression') : 'expression');
    fail(ctx, `expected name as lookup value after dot on ${targetName}, got ${val.value}`,
      val.lineno,
      val.colno);
  }

  const lookup = literal(val.lineno, val.colno, val.value);
  const node = lookupVal(tok.lineno, tok.colno, target, lookup);
  markBracketNotation(node, false);
  return node;
};
