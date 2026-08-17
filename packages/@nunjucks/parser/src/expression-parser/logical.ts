import type { TemplateError } from '@nunjucks/error-formatter';
import { TOKEN_COLON, TOKEN_OPERATOR } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { and, inlineIf, not, nullishCoalesce, or } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { fail, nextToken, peekToken, skipOperator, skipSymbol, skipValue } from '../cursor.ts';
import { binaryOp } from './binary-helpers.ts';
import { parseIn } from './comparison.ts';

const parseNullishCoalesce = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, {
    create: nullishCoalesce,
    consume: (cursor) => skipValue(cursor, TOKEN_OPERATOR, '??'),
    next: parseAnd,
  });

const parseNot = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;
  if (tok.type === TOKEN_OPERATOR && tok.value === '!') {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
    const innerR = parseNot(parserContext);
    if (isErr(innerR)) {
      return innerR;
    }
    return ok(not(loc(tok), innerR.value));
  }
  if (skipSymbol(parserContext, 'not')) {
    const innerR = parseNot(parserContext);
    if (isErr(innerR)) {
      return innerR;
    }
    return ok(not(loc(tok), innerR.value));
  }
  // WHY: no third `!` branch — the peeked-operator branch above already consumed that
  // case; the old skipOperator re-test of the same peeked token was unreachable.
  return parseIn(parserContext);
};

const parseAnd = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, {
    create: and,
    consume: (cursor) => skipSymbol(cursor, 'and') || skipOperator(cursor, '&&'),
    next: parseNot,
  });

const parseOr = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, {
    create: or,
    consume: (cursor) => skipSymbol(cursor, 'or') || skipOperator(cursor, '||'),
    next: parseNullishCoalesce,
  });

const parseTernary = (parserContext: ParserContext, node: Node): Result<Node, TemplateError> => {
  if (skipValue(parserContext, TOKEN_OPERATOR, '?')) {
    const thenR = parseOr(parserContext);
    if (isErr(thenR)) {
      return thenR;
    }
    if (!skipValue(parserContext, TOKEN_COLON, ':')) {
      // WHY: a consumed `?` without its `:` must fail loudly — silently returning the
      // condition would render `{{ a ? b }}` as `a` (wrong output, no diagnostic).
      return fail(parserContext, {
        message: 'expected : in ternary expression',
        lineno: thenR.value.lineno,
        colno: thenR.value.colno,
      });
    }
    const elseR = parseOr(parserContext);
    if (isErr(elseR)) {
      return elseR;
    }
    const newNode = inlineIf(loc(node), {
      cond: node,
      body: thenR.value,
      alternate: elseR.value,
    });
    return parseTernary(parserContext, newNode);
  }
  return ok(node);
};

export { parseOr, parseTernary };
