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

const parseSpread = (
  ctx: ParserContext,
  node: ChildrenNode,
  origin: NodeLocation
): ChildrenNode => {
  nextToken(ctx);
  const argument = parseExpression(ctx);
  return appendChild(
    node,
    spread(origin.lineno, origin.colno, argument)
  );
};

const parseDictItem = (
  ctx: ParserContext,
  node: ChildrenNode,
  origin: NodeLocation
): ChildrenNode => {
  if (peekToken(ctx).type === TOKEN_SPREAD) {
    return parseSpread(ctx, node, origin);
  }
  const key = parsePrimary(ctx);
  if (skip(ctx, TOKEN_COLON)) {
    const value = parseExpression(ctx);
    return appendChild(
      node,
      pair(key.lineno, key.colno, key, value)
    );
  }

  const next = peekToken(ctx);
  const value = symbol(key.lineno, key.colno, String(key.value));
  if (next && (next.type === TOKEN_COMMA || next.type === TOKEN_RIGHT_CURLY)) {
    return appendChild(
      node,
      pair(key.lineno, key.colno, key, value)
    );
  }

  if (next?.type === TOKEN_OPERATOR && next.value === '=') {
    nextToken(ctx);
    const defaultValue = parseExpression(ctx);
    const pattern = assignmentPattern(
      key.lineno,
      key.colno,
      value,
      defaultValue
    );
    return appendChild(
      node,
      pair(key.lineno, key.colno, key, pattern)
    );
  }

  fail(
    ctx,
    'parseAggregate: expected colon after dict key',
    next?.lineno ?? origin.lineno,
    next?.colno ?? origin.colno,
    EXPECTED_COLON_AFTER_DICT_KEY
  );
  return undefined as never;
};

export const parseAggregateExpression = (
  ctx: ParserContext,
  node: ChildrenNode,
  origin: NodeLocation
): ChildrenNode => {
  if (isDict(node)) {
    return parseDictItem(ctx, node, origin);
  }
  if (peekToken(ctx).type === TOKEN_SPREAD) {
    return parseSpread(ctx, node, origin);
  }

  const expression = parseExpression(ctx);
  if (skipValue(ctx, TOKEN_OPERATOR, '=')) {
    const defaultValue = parseExpression(ctx);
    return appendChild(
      node,
      assignmentPattern(
        expression.lineno,
        expression.colno,
        expression,
        defaultValue
      )
    );
  }
  return appendChild(node, expression);
};
