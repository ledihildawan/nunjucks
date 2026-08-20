import type { TemplateError } from '@nunjucks/error-formatter';
import {
  TOKEN_COLON,
  TOKEN_COMMA,
  TOKEN_OPERATOR,
  TOKEN_RIGHT_CURLY,
  TOKEN_SPREAD,
} from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node, NodeLocation } from '@nunjucks/nodes';
import { assignmentPattern, pair, spread, symbol } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../../cursor.ts';
import { fail, nextToken, peekToken, skip, skipValue } from '../../cursor.ts';
import { EXPECTED_COLON_AFTER_DICT_KEY } from '../../error.ts';

const parseSpread = (
  parserContext: ParserContext,
  origin: NodeLocation
): Result<Node, TemplateError> => {
  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) {
    return consumedR;
  }
  const argumentR = parserContext.parseExpression();
  if (isErr(argumentR)) {
    return argumentR;
  }
  return ok(spread(loc(origin), { argument: argumentR.value }));
};

const parseDictDefaultAssignment = (
  parserContext: ParserContext,
  key: Node
): Result<Node, TemplateError> => {
  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) {
    return consumedR;
  }
  const defaultValueR = parserContext.parseExpression();
  if (isErr(defaultValueR)) {
    return defaultValueR;
  }
  return ok(
    assignmentPattern(loc(key), {
      target: symbol(loc(key), String(key.value)),
      defaultVal: defaultValueR.value,
    })
  );
};

const parseDictItem = (
  parserContext: ParserContext,
  origin: NodeLocation
): Result<Node, TemplateError> => {
  const peekR = peekToken(parserContext);
  if (isErr(peekR)) {
    return peekR;
  }
  if (peekR.value.type === TOKEN_SPREAD) {
    return parseSpread(parserContext, origin);
  }
  const keyR = parserContext.parsePrimary();
  if (isErr(keyR)) {
    return keyR;
  }
  const key = keyR.value;
  if (skip(parserContext, TOKEN_COLON)) {
    const valueR = parserContext.parseExpression();
    if (isErr(valueR)) {
      return valueR;
    }
    return ok(pair(loc(key), { key, val: valueR.value }));
  }

  const nextR = peekToken(parserContext);
  if (isErr(nextR)) {
    return nextR;
  }
  const next = nextR.value;
  const value = symbol(loc(key), String(key.value));
  if (next.type === TOKEN_COMMA || next.type === TOKEN_RIGHT_CURLY) {
    return ok(pair(loc(key), { key, val: value }));
  }

  if (next?.type === TOKEN_OPERATOR && next.value === '=') {
    const patternR = parseDictDefaultAssignment(parserContext, key);
    if (isErr(patternR)) {
      return patternR;
    }
    return ok(pair(loc(key), { key, val: patternR.value }));
  }

  return fail(parserContext, {
    message: 'parseAggregate: expected colon after dict key',
    lineno: next?.lineno ?? origin.lineno,
    colno: next?.colno ?? origin.colno,
    sentinel: EXPECTED_COLON_AFTER_DICT_KEY,
  });
};

/**
 * Parses one aggregate element: spread, dict pair, or expression —
 * wrapping `expr = default` in an `assignmentPattern` where allowed.
 */
export const parseAggregateExpression = (
  parserContext: ParserContext,
  dictAggregate: boolean,
  origin: NodeLocation
): Result<Node, TemplateError> => {
  if (dictAggregate) {
    return parseDictItem(parserContext, origin);
  }
  const peekR = peekToken(parserContext);
  if (isErr(peekR)) {
    return peekR;
  }
  if (peekR.value.type === TOKEN_SPREAD) {
    return parseSpread(parserContext, origin);
  }

  const expressionR = parserContext.parseExpression();
  if (isErr(expressionR)) {
    return expressionR;
  }
  const expression = expressionR.value;
  if (skipValue(parserContext, TOKEN_OPERATOR, '=')) {
    const defaultValueR = parserContext.parseExpression();
    if (isErr(defaultValueR)) {
      return defaultValueR;
    }
    return ok(
      assignmentPattern(loc(expression), { target: expression, defaultVal: defaultValueR.value })
    );
  }
  return ok(expression);
};
