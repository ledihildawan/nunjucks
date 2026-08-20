import type { TemplateError } from '@nunjucks/error-formatter';
import type { Token } from '@nunjucks/lexer';
import {
  isSymbolToken,
  TOKEN_BOOLEAN,
  TOKEN_FLOAT,
  TOKEN_INT,
  TOKEN_NONE,
  TOKEN_OPERATOR,
  TOKEN_REGEX,
  TOKEN_STRING,
  TOKEN_TEMPLATE_LITERAL,
} from '@nunjucks/lexer';
import { isErr, isOk, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { bitwiseNot, decrement, increment, literal, neg, pos, symbol } from '@nunjucks/nodes';
import { isDangerousRegexPattern } from '@nunjucks/security';
import { type Loc, loc } from '@nunjucks/shared';
import { find } from 'remeda';
import type { ParserContext } from '../cursor.ts';
import { fail, nextToken, peekToken, peekTokenOrNull, pushToken, skipValue } from '../cursor.ts';
import { EXPECTED_COLON_AFTER_DICT_KEY } from '../error.ts';
import { parseAggregate } from '../node-parser/aggregate/index.ts';
import { tryParsePattern } from '../node-parser/pattern.ts';
import { parseTemplateLiteral } from '../node-parser/template-literal.ts';
import { parsePipeForward, parsePostfix } from './postfix/index.ts';

// WHY: cap template-supplied regex literal length — long patterns can trigger
// catastrophic backtracking (ReDoS) once compiled; mirrors the runtime's
// MAX_MATCHES_PATTERN_LENGTH guard in builtin-predicates.ts.
const MAX_REGEX_LITERAL_LENGTH = 256;

const parseBooleanValue = (tok: Token): boolean | undefined => {
  if (tok.value === 'true') {
    return true;
  }
  if (tok.value === 'false') {
    return false;
  }
  return undefined;
};

const handleLiteralToken = (
  tok: Token,
  parserContext: ParserContext
): Result<Node | undefined, TemplateError> => {
  switch (tok.type) {
    case TOKEN_STRING:
      return ok(literal(loc(tok), tok.value));
    case TOKEN_INT:
    case TOKEN_FLOAT:
      return ok(literal(loc(tok), tok.value));
    case TOKEN_BOOLEAN: {
      const value = parseBooleanValue(tok);
      if (value === undefined) {
        return fail(parserContext, {
          message: `invalid boolean: ${tok.value}`,
          lineno: tok.lineno,
          colno: tok.colno,
        });
      }
      return ok(literal(loc(tok), value));
    }
    case TOKEN_NONE:
      return ok(literal(loc(tok), null));
    case TOKEN_REGEX: {
      const { body, flags } = tok.value;
      if (body.length > MAX_REGEX_LITERAL_LENGTH) {
        return fail(parserContext, {
          message: `regex literal exceeds ${MAX_REGEX_LITERAL_LENGTH} characters (ReDoS guard)`,
          lineno: tok.lineno,
          colno: tok.colno,
        });
      }
      // WHY: length alone cannot neutralize catastrophic backtracking — `(a+)+$` is
      // 7 characters — so nested-quantifier shapes are rejected at the single choke
      // point where template-authored regexes are born. This also covers every filter
      // that later consumes the compiled RegExp instance (e.g. `replace`).
      if (isDangerousRegexPattern(body)) {
        return fail(parserContext, {
          message: 'regex literal contains a nested quantifier such as (a+)+ (ReDoS guard)',
          lineno: tok.lineno,
          colno: tok.colno,
        });
      }
      return ok(literal(loc(tok), new RegExp(body, flags)));
    }
  }
  return ok(undefined);
};

const handleSymbolOrTemplate = (
  tok: Token,
  parserContext: ParserContext
): Result<Node | null, TemplateError> => {
  if (isSymbolToken(tok)) {
    return ok(symbol(loc(tok), tok.value));
  }
  if (tok.type === TOKEN_TEMPLATE_LITERAL) {
    pushToken(parserContext, tok);
    const tlR = parseTemplateLiteral(parserContext);
    if (isErr(tlR)) {
      return tlR;
    }
    return ok(tlR.value);
  }
  return ok(null);
};

const parseAggregateOrPattern = (
  parserContext: ParserContext
): Result<Node | null, TemplateError> => {
  const aggR = parseAggregate(parserContext);
  if (isOk(aggR)) {
    return aggR;
  }
  if ((aggR.error as { sentinel?: unknown }).sentinel === EXPECTED_COLON_AFTER_DICT_KEY) {
    const patternR = tryParsePattern(parserContext);
    if (isOk(patternR) && patternR.value !== null) {
      return patternR;
    }
    if (isErr(patternR)) {
      return patternR;
    }
  }
  return aggR;
};

const parsePrimaryRaw = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tokR = nextToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;

  const literalR = handleLiteralToken(tok, parserContext);
  if (isErr(literalR)) {
    return literalR;
  }
  if (literalR.value) {
    return ok(literalR.value);
  }

  const symbolR = handleSymbolOrTemplate(tok, parserContext);
  if (isErr(symbolR)) {
    return symbolR;
  }
  if (symbolR.value) {
    return ok(symbolR.value);
  }

  pushToken(parserContext, tok);
  const aggregateR = parseAggregateOrPattern(parserContext);
  if (isErr(aggregateR)) {
    return aggregateR;
  }
  const aggregateNode = aggregateR.value;
  if (!aggregateNode) {
    return fail(parserContext, {
      message: `expected expression, got ${tok.type}`,
      lineno: tok.lineno,
      colno: tok.colno,
    });
  }
  return ok(aggregateNode);
};

/**
 * Parses a primary expression — literal, symbol, template literal,
 * aggregate, or destructuring pattern — then chains any postfix accesses
 * and calls onto it.
 */
const parsePrimary = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const rawR = parsePrimaryRaw(parserContext);
  if (isErr(rawR)) {
    return rawR;
  }
  return parsePostfix(parserContext, rawR.value);
};

/** Parses a primary expression without postfix chaining, for names where `(` is not a call. */
const parsePrimaryWithoutPostfix = (parserContext: ParserContext): Result<Node, TemplateError> =>
  parsePrimaryRaw(parserContext);

const PREFIX_OPERATORS: ReadonlyArray<{
  operator: string;
  build: (loc: Loc, inner: Node) => Node;
}> = [
  { operator: '-', build: (origin, inner) => neg(origin, inner) },
  { operator: '+', build: (origin, inner) => pos(origin, inner) },
  { operator: '~', build: (origin, inner) => bitwiseNot(origin, inner) },
  {
    operator: '++',
    build: (origin, inner) => increment(origin, { target: inner, isPostfix: false }),
  },
  {
    operator: '--',
    build: (origin, inner) => decrement(origin, { target: inner, isPostfix: false }),
  },
];

const tryParsePrefixOperator = (
  parserContext: ParserContext,
  tok: Token
): Result<Node | null, TemplateError> => {
  const peeked = peekTokenOrNull(parserContext);
  const matched = find(
    PREFIX_OPERATORS,
    ({ operator }) => peeked?.type === TOKEN_OPERATOR && peeked?.value === operator
  );
  if (!matched) {
    return ok(null);
  }
  skipValue(parserContext, TOKEN_OPERATOR, matched.operator);
  const innerR = parseUnaryWithoutPipes(parserContext);
  if (isErr(innerR)) {
    return innerR;
  }
  return ok(matched.build(loc(tok), innerR.value));
};

const parseUnaryWithoutPipes = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;

  const prefixR = tryParsePrefixOperator(parserContext, tok);
  if (isErr(prefixR)) {
    return prefixR;
  }

  if (prefixR.value !== null) {
    return ok(prefixR.value);
  }

  return parsePrimary(parserContext);
};

/**
 * Parses a unary expression: optional prefix operators (`-`, `+`, `~`,
 * `++`, `--`) applied to a primary, followed by `|>` pipe-forward calls.
 */
const parseUnary = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const baseR = parseUnaryWithoutPipes(parserContext);
  if (isErr(baseR)) {
    return baseR;
  }
  return parsePipeForward(parserContext, baseR.value);
};

export { parsePrimary, parsePrimaryWithoutPostfix, parseUnary };
