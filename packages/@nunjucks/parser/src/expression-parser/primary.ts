import type { Token } from '@nunjucks/lexer';
import {
  TOKEN_STRING,
  TOKEN_INT,
  TOKEN_FLOAT,
  TOKEN_BOOLEAN,
  TOKEN_NONE,
  TOKEN_REGEX,
  TOKEN_OPERATOR,
  TOKEN_TEMPLATE_LITERAL,
  isSymbolToken,
} from '@nunjucks/lexer';
import { literal, symbol, neg, pos, bitwiseNot, increment, decrement } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { nextToken, peekToken, peekTokenOrNull, pushToken, skipValue, fail } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';
import type { Loc } from '@nunjucks/shared';
import { ok, isOk, isErr, type Result } from '@nunjucks/lib';
import { find } from 'remeda';
import { EXPECTED_COLON_AFTER_DICT_KEY } from '../error.ts';
import { tryParsePattern } from '../node-parser/pattern.ts';
import { parseAggregate } from '../node-parser/aggregate/index.ts';
import { parseTemplateLiteral } from '../node-parser/template-literal.ts';
import { parsePostfix, parsePipeForward } from './postfix/index.ts';
import { loc } from '@nunjucks/lexer';

const parseBooleanValue = (tok: Token): boolean | undefined => {
  if (tok.value === 'true') { return true; }
  if (tok.value === 'false') { return false; }
  return undefined;
};

const handleLiteralToken = (tok: Token, parserContext: ParserContext): Result<Node | undefined, TemplateError> => {
  switch (tok.type) {
    case TOKEN_STRING:
      return ok(literal(loc(tok), tok.value));
    case TOKEN_INT:
    case TOKEN_FLOAT:
      return ok(literal(loc(tok), tok.value));
    case TOKEN_BOOLEAN: {
      const value = parseBooleanValue(tok);
      if (value === undefined) {
        return fail(parserContext, `invalid boolean: ${tok.value}`, { lineno: tok.lineno, colno: tok.colno });
      }
      return ok(literal(loc(tok), value));
    }
    case TOKEN_NONE:
      return ok(literal(loc(tok), null));
    case TOKEN_REGEX: {
      const { body, flags } = tok.value;
      return ok(literal(loc(tok), new RegExp(body, flags)));
    }
  }
  return ok(undefined);
};

const handleSymbolOrTemplate = (tok: Token, parserContext: ParserContext): Result<Node | null, TemplateError> => {
  if (isSymbolToken(tok)) {
    return ok(symbol(loc(tok), tok.value));
  }
  if (tok.type === TOKEN_TEMPLATE_LITERAL) {
    pushToken(parserContext, tok);
    const tlR = parseTemplateLiteral(parserContext);
    if (isErr(tlR)) { return tlR; }
    return ok(tlR.value);
  }
  return ok(null);
};

const parseAggregateOrPattern = (parserContext: ParserContext): Result<Node | null, TemplateError> => {
  const aggR = parseAggregate(parserContext);
  if (isOk(aggR)) { return aggR; }
  if ((aggR.error as { sentinel?: unknown }).sentinel === EXPECTED_COLON_AFTER_DICT_KEY) {
    const patternR = tryParsePattern(parserContext);
    if (isOk(patternR) && patternR.value !== null) {
      return patternR;
    }
    if (isErr(patternR)) { return patternR; }
  }
  return aggR;
};

const parsePrimaryRaw = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tokR = nextToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;

  const literalR = handleLiteralToken(tok, parserContext);
  if (isErr(literalR)) { return literalR; }
  if (literalR.value) {
    return ok(literalR.value);
  }

  const symbolR = handleSymbolOrTemplate(tok, parserContext);
  if (isErr(symbolR)) { return symbolR; }
  if (symbolR.value) {
    return ok(symbolR.value);
  }

  pushToken(parserContext, tok);
  const aggregateR = parseAggregateOrPattern(parserContext);
  if (isErr(aggregateR)) { return aggregateR; }
  const aggregateNode = aggregateR.value;
  if (!aggregateNode) {
    return fail(parserContext, `expected expression, got ${tok.type}`, { lineno: tok.lineno, colno: tok.colno });
  }
  return ok(aggregateNode);
};

const parsePrimary = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const rawR = parsePrimaryRaw(parserContext);
  if (isErr(rawR)) { return rawR; }
  return parsePostfix(parserContext, rawR.value);
};

const parsePrimaryWithoutPostfix = (parserContext: ParserContext): Result<Node, TemplateError> =>
  parsePrimaryRaw(parserContext);

const PREFIX_OPERATORS: ReadonlyArray<{ operator: string; build: (loc: Loc, inner: Node) => Node }> = [
  { operator: '-', build: (origin, inner) => neg(origin, inner) },
  { operator: '+', build: (origin, inner) => pos(origin, inner) },
  { operator: '~', build: (origin, inner) => bitwiseNot(origin, inner) },
  { operator: '++', build: (origin, inner) => increment(origin, { target: inner, isPostfix: false }) },
  { operator: '--', build: (origin, inner) => decrement(origin, { target: inner, isPostfix: false }) },
];

const tryParsePrefixOperator = (parserContext: ParserContext, tok: Token): Result<Node | null, TemplateError> => {
  const peeked = peekTokenOrNull(parserContext);
  const matched = find(PREFIX_OPERATORS, ({ operator }) =>
    peeked?.type === TOKEN_OPERATOR && peeked?.value === operator);
  if (!matched) {
    return ok(null);
  }
  skipValue(parserContext, TOKEN_OPERATOR, matched.operator);
  const innerR = parseUnaryWithoutPipes(parserContext);
  if (isErr(innerR)) { return innerR; }
  return ok(matched.build(loc(tok), innerR.value));
};

const parseUnaryWithoutPipes = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;

  const prefixR = tryParsePrefixOperator(parserContext, tok);
  if (isErr(prefixR)) { return prefixR; }

  if (prefixR.value !== null) {
    return ok(prefixR.value);
  }

  return parsePrimary(parserContext);
};

const parseUnary = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const baseR = parseUnaryWithoutPipes(parserContext);
  if (isErr(baseR)) { return baseR; }
  return parsePipeForward(parserContext, baseR.value);
};

export { parsePrimary, parsePrimaryWithoutPostfix, parseUnary, parseUnaryWithoutPipes };
