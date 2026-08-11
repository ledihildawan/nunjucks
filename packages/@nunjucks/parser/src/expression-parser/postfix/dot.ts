import { TOKEN_SYMBOL, type TOKEN_OPERATOR } from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import { literal, lookupVal } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import { nextToken, fail } from "../../cursor.ts";
import type { ParserContext } from "../../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/lib';
import { markBracketNotation } from "./lookup.ts";
import { loc } from '@nunjucks/shared';

type DotOperatorToken = Token & { type: typeof TOKEN_OPERATOR };

export const parseDotAccess = (parserContext: ParserContext, tok: DotOperatorToken, target: Node): Result<Node, TemplateError> => {
  const consumedDotR = nextToken(parserContext);
  if (isErr(consumedDotR)) { return consumedDotR; }
  const valueR = nextToken(parserContext);
  if (isErr(valueR)) { return valueR; }
  const value = valueR.value;

  if (value.type !== TOKEN_SYMBOL) {
    const targetName = (target ? String(target.value ?? 'expression') : 'expression');
    return fail(parserContext, `expected name as lookup value after dot on ${targetName}, got ${value.value}`,
      value.lineno,
      value.colno);
  }

  const lookup = literal(loc(value), value.value);
  const node = lookupVal(loc(tok), { target, val: lookup });
  markBracketNotation(node, false);
  return ok(node);
};
