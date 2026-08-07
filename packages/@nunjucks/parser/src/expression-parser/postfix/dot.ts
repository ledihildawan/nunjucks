import { TOKEN_SYMBOL, type TOKEN_OPERATOR } from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import { literal, lookupVal } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { nextToken, fail } from "../../cursor.ts";
import type { ParserContext } from "../../cursor.ts";
import { markBracketNotation } from "./lookup.ts";

type DotOperatorToken = Token & { type: typeof TOKEN_OPERATOR };

export const parseDotAccess = (parserContext: ParserContext, tok: DotOperatorToken, target: Node): Node => {
  nextToken(parserContext);
  const value = nextToken(parserContext);

  if (value.type !== TOKEN_SYMBOL) {
    const targetName = (target ? String(target.value ?? 'expression') : 'expression');
    fail(parserContext, `expected name as lookup value after dot on ${targetName}, got ${value.value}`,
      value.lineno,
      value.colno);
  }

  const lookup = literal(value.lineno, value.colno, value.value);
  const node = lookupVal(tok.lineno, tok.colno, target, lookup);
  markBracketNotation(node, false);
  return node;
};
