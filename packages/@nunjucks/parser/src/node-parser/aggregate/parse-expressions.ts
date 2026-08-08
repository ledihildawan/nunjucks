import {
  TOKEN_COLON,
  TOKEN_COMMA,
  TOKEN_OPERATOR,
  TOKEN_RIGHT_CURLY,
  TOKEN_SPREAD,
} from '@nunjucks/lexer';
import {
  appendChild,
  assignmentPattern,
  isDict,
  pair,
  spread,
  symbol,
} from '@nunjucks/nodes';
import type { ChildrenNode, NodeLocation } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import {
  fail,
  nextToken,
  peekToken,
  skip,
  skipValue,
} from '../../cursor.ts';
import { EXPECTED_COLON_AFTER_DICT_KEY } from '../../index.ts';
import type { ParserContext } from '../../cursor.ts';
import { ok, isErr, type Result } from '@nunjucks/shared';
import { parseExpression, parsePrimary } from '../../expression-parser/index.ts';
import { loc } from '@nunjucks/shared';

const parseSpread = (
  parserContext: ParserContext,
  node: ChildrenNode,
  origin: NodeLocation
): Result<ChildrenNode, TemplateError> => {
  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) { return consumedR; }
  const argumentR = parseExpression(parserContext);
  if (isErr(argumentR)) { return argumentR; }
  return ok(appendChild(
    node,
    spread(loc(origin), { argument: argumentR.value })
  ));
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Result unwrap-and-return short-circuits inflate branching
const parseDictItem = (parserContext: ParserContext, node: ChildrenNode, origin: NodeLocation): Result<ChildrenNode, TemplateError> => {
  const peekR = peekToken(parserContext);
  if (isErr(peekR)) { return peekR; }
  if (peekR.value.type === TOKEN_SPREAD) {
    return parseSpread(parserContext, node, origin);
  }
  const keyR = parsePrimary(parserContext);
  if (isErr(keyR)) { return keyR; }
  const key = keyR.value;
  if (skip(parserContext, TOKEN_COLON)) {
    const valueR = parseExpression(parserContext);
    if (isErr(valueR)) { return valueR; }
    return ok(appendChild(
      node,
      pair(loc(key), { key, val: valueR.value })
    ));
  }

  const nextR = peekToken(parserContext);
  if (isErr(nextR)) { return nextR; }
  const next = nextR.value;
  const value = symbol(loc(key), String(key.value));
  if (next.type === TOKEN_COMMA || next.type === TOKEN_RIGHT_CURLY) {
    return ok(appendChild(
      node,
      pair(loc(key), { key, val: value })
    ));
  }

  if (next?.type === TOKEN_OPERATOR && next.value === '=') {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
    const defaultValueR = parseExpression(parserContext);
    if (isErr(defaultValueR)) { return defaultValueR; }
    const pattern = assignmentPattern(
      loc(key),
      { target: value, defaultVal: defaultValueR.value }
    );
    return ok(appendChild(
      node,
      pair(loc(key), { key, val: pattern })
    ));
  }

  return fail(
    parserContext,
    'parseAggregate: expected colon after dict key',
    next?.lineno ?? origin.lineno,
    next?.colno ?? origin.colno,
    EXPECTED_COLON_AFTER_DICT_KEY
  );
};

export const parseAggregateExpression = (
  parserContext: ParserContext,
  node: ChildrenNode,
  origin: NodeLocation
): Result<ChildrenNode, TemplateError> => {
  if (isDict(node)) {
    return parseDictItem(parserContext, node, origin);
  }
  const peekR = peekToken(parserContext);
  if (isErr(peekR)) { return peekR; }
  if (peekR.value.type === TOKEN_SPREAD) {
    return parseSpread(parserContext, node, origin);
  }

  const expressionR = parseExpression(parserContext);
  if (isErr(expressionR)) { return expressionR; }
  const expression = expressionR.value;
  if (skipValue(parserContext, TOKEN_OPERATOR, '=')) {
    const defaultValueR = parseExpression(parserContext);
    if (isErr(defaultValueR)) { return defaultValueR; }
    return ok(appendChild(
      node,
      assignmentPattern(
        loc(expression),
        { target: expression, defaultVal: defaultValueR.value }
      )
    ));
  }
  return ok(appendChild(node, expression));
};
