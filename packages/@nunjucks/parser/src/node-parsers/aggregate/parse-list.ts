import {
  TOKEN_COMMA,
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_CURLY,
  TOKEN_LEFT_PAREN,
  TOKEN_RIGHT_BRACKET,
  TOKEN_RIGHT_CURLY,
  TOKEN_RIGHT_PAREN,
  TOKEN_SYMBOL,
} from '@nunjucks/lexer';
import { appendChild, hole } from '@nunjucks/nodes';
import type { ChildrenNode } from '@nunjucks/nodes';
import { fail, nextToken, peekToken, skip } from '../../cursor.ts';
import type { ParserContext } from '../../cursor.ts';

const isClosingToken = (type: string): boolean =>
  type === TOKEN_RIGHT_PAREN ||
  type === TOKEN_RIGHT_BRACKET ||
  type === TOKEN_RIGHT_CURLY;

const canFollowWithoutComma = (type: string): boolean =>
  type === TOKEN_SYMBOL ||
  type === TOKEN_LEFT_BRACKET ||
  type === TOKEN_LEFT_CURLY ||
  type === TOKEN_LEFT_PAREN;

const prepareAfterComma = (
  ctx: ParserContext,
  node: ChildrenNode,
  origin: { lineno: number; colno: number }
): { node: ChildrenNode; done: boolean; skipExpression: boolean } => {
  const afterComma = peekToken(ctx).type;
  const followedByHole = afterComma === TOKEN_COMMA;
  const followedByClose =
    afterComma === TOKEN_RIGHT_BRACKET ||
    afterComma === TOKEN_RIGHT_PAREN;
  if (!followedByHole && !followedByClose) {
    return { node, done: false, skipExpression: false };
  }
  const nextNode = appendChild(
    node,
    hole(origin.lineno, origin.colno)
  ) as ChildrenNode;
  if (followedByClose) {
    nextToken(ctx);
  }
  return {
    node: nextNode,
    done: followedByClose,
    skipExpression: followedByHole,
  };
};

export const prepareListItem = (
  ctx: ParserContext,
  node: ChildrenNode,
  origin: { lineno: number; colno: number }
): { node: ChildrenNode; done: boolean; skipExpression: boolean } => {
  const current = peekToken(ctx);
  if (isClosingToken(current.type)) {
    nextToken(ctx);
    return { node, done: true, skipExpression: false };
  }

  if (node.children.length === 0) {
    return { node, done: false, skipExpression: false };
  }

  if (skip(ctx, TOKEN_COMMA)) {
    return prepareAfterComma(ctx, node, origin);
  }

  if (!canFollowWithoutComma(current.type)) {
    fail(
      ctx,
      'parseAggregate: expected comma after expression',
      current.lineno,
      current.colno
    );
  }
  return { node, done: false, skipExpression: false };
};
