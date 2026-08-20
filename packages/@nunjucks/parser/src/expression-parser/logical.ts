import type { TemplateError } from '@nunjucks/error-formatter';
import type { Token } from '@nunjucks/lexer';
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
  // WHY: collect prefix operators, parse the operand once, then wrap inside-out —
  // the recursive form recursed once per `!`/`not` token, so `!!!!...a` overflowed
  // the stack on token-count-long chains (parser loop exemption applies).
  const negationTokens: Token[] = [];
  while (true) {
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
      negationTokens.push(tok);
      continue;
    }
    if (skipSymbol(parserContext, 'not')) {
      negationTokens.push(tok);
      continue;
    }
    // WHY: no third `!` branch — the peeked-operator branch above already consumed that
    // case; the old skipOperator re-test of the same peeked token was unreachable.
    break;
  }

  const innerR = parseIn(parserContext);
  if (isErr(innerR)) {
    return innerR;
  }
  let node = innerR.value;
  for (let i = negationTokens.length - 1; i >= 0; i--) {
    const negTok = negationTokens[i];
    if (negTok) {
      node = not(loc(negTok), node);
    }
  }
  return ok(node);
};

const parseAnd = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, {
    create: and,
    consume: (cursor) => skipSymbol(cursor, 'and') || skipOperator(cursor, '&&'),
    next: parseNot,
  });

/**
 * Parses `or` / `||` chains, the loosest logical level and the entry point
 * of the boolean precedence chain.
 */
const parseOr = (parserContext: ParserContext): Result<Node, TemplateError> =>
  binaryOp(parserContext, {
    create: or,
    consume: (cursor) => skipSymbol(cursor, 'or') || skipOperator(cursor, '||'),
    next: parseNullishCoalesce,
  });

/**
 * Parses `? :` ternaries onto an already-parsed condition; a consumed `?`
 * without its closing `:` fails loudly rather than silently returning the
 * condition.
 */
const parseTernary = (parserContext: ParserContext, node: Node): Result<Node, TemplateError> => {
  // WHY: iterative loop (parser loop exemption) — the recursive form recursed once per
  // `?`, so `a ? a : a ? a : a...` overflowed the stack on token-count-long chains.
  let current = node;
  while (skipValue(parserContext, TOKEN_OPERATOR, '?')) {
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
    current = inlineIf(loc(current), {
      cond: current,
      body: thenR.value,
      alternate: elseR.value,
    });
  }
  return ok(current);
};

export { parseOr, parseTernary };
