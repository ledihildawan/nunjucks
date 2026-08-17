import type { TemplateError } from '@nunjucks/error-formatter';
import type { Token } from '@nunjucks/lexer';
import { type TOKEN_OPERATOR, TOKEN_SYMBOL } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { literal, lookupVal } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../../cursor.ts';
import { fail, nextToken } from '../../cursor.ts';
import { markAsDot } from './lookup.ts';

type DotOperatorToken = Token & { type: typeof TOKEN_OPERATOR };

export const parseDotAccess = (
  parserContext: ParserContext,
  tok: DotOperatorToken,
  target: Node
): Result<Node, TemplateError> => {
  const consumedDotR = nextToken(parserContext);
  if (isErr(consumedDotR)) {
    return consumedDotR;
  }
  const valueR = nextToken(parserContext);
  if (isErr(valueR)) {
    return valueR;
  }
  const value = valueR.value;

  if (value.type !== TOKEN_SYMBOL) {
    const targetName = target ? String(target.value ?? 'expression') : 'expression';
    return fail(parserContext, {
      message: `expected name as lookup value after dot on ${targetName}, got ${value.value}`,
      lineno: value.lineno,
      colno: value.colno,
    });
  }

  const lookup = literal(loc(value), value.value);
  const node = lookupVal(loc(tok), { target, val: lookup });
  markAsDot(node);
  return ok(node);
};
