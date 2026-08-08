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
import {
  fail,
  nextToken,
  peekToken,
  skip,
  skipValue,
} from '../../cursor.ts';
import { EXPECTED_COLON_AFTER_DICT_KEY } from '../../index.ts';
import type { ParserContext } from '../../cursor.ts';
import { parseExpression, parsePrimary } from '../../expression-parser/index.ts';
import { loc } from '@nunjucks/shared';

const parseSpread = (
  parserContext: ParserContext,
  node: ChildrenNode,
  origin: NodeLocation
): ChildrenNode => {
  nextToken(parserContext);
  const argument = parseExpression(parserContext);
  return appendChild(
    node,
    spread(loc(origin), { argument })
  );
};

const parseDictItem = (
  parserContext: ParserContext,
  node: ChildrenNode,
  origin: NodeLocation
): ChildrenNode => {
  if (peekToken(parserContext).type === TOKEN_SPREAD) {
    return parseSpread(parserContext, node, origin);
  }
  const key = parsePrimary(parserContext);
  if (skip(parserContext, TOKEN_COLON)) {
    const value = parseExpression(parserContext);
    return appendChild(
      node,
      pair(loc(key), { key, val: value })
    );
  }

  const next = peekToken(parserContext);
  const value = symbol(loc(key), String(key.value));
  if (next && (next.type === TOKEN_COMMA || next.type === TOKEN_RIGHT_CURLY)) {
    return appendChild(
      node,
      pair(loc(key), { key, val: value })
    );
  }

  if (next?.type === TOKEN_OPERATOR && next.value === '=') {
    nextToken(parserContext);
    const defaultValue = parseExpression(parserContext);
    const pattern = assignmentPattern(
      loc(key),
      { target: value, defaultVal: defaultValue }
    );
    return appendChild(
      node,
      pair(loc(key), { key, val: pattern })
    );
  }

  fail(
    parserContext,
    'parseAggregate: expected colon after dict key',
    next?.lineno ?? origin.lineno,
    next?.colno ?? origin.colno,
    EXPECTED_COLON_AFTER_DICT_KEY
  );
  return undefined as never;
};

export const parseAggregateExpression = (
  parserContext: ParserContext,
  node: ChildrenNode,
  origin: NodeLocation
): ChildrenNode => {
  if (isDict(node)) {
    return parseDictItem(parserContext, node, origin);
  }
  if (peekToken(parserContext).type === TOKEN_SPREAD) {
    return parseSpread(parserContext, node, origin);
  }

  const expression = parseExpression(parserContext);
  if (skipValue(parserContext, TOKEN_OPERATOR, '=')) {
    const defaultValue = parseExpression(parserContext);
    return appendChild(
      node,
      assignmentPattern(
        loc(expression),
        { target: expression, defaultVal: defaultValue }
      )
    );
  }
  return appendChild(node, expression);
};
