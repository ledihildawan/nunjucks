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
import type { ChildrenNode, NodeLocation } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { loc } from '@nunjucks/lexer';
import { ok, isErr, type Result } from '@nunjucks/lib';
import { fail, nextToken, peekToken, skip } from '../../cursor.ts';
import type { ParserContext } from '../../cursor.ts';

interface ListState {
  node: ChildrenNode;
  done: boolean;
  skipExpression: boolean;
}

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
  parserContext: ParserContext,
  node: ChildrenNode,
  origin: NodeLocation
): Result<ListState, TemplateError> => {
  const afterCommaR = peekToken(parserContext);
  if (isErr(afterCommaR)) { return afterCommaR; }
  const afterComma = afterCommaR.value.type;
  const followedByHole = afterComma === TOKEN_COMMA;
  const followedByClose =
    afterComma === TOKEN_RIGHT_BRACKET ||
    afterComma === TOKEN_RIGHT_PAREN;
  if (!followedByHole && !followedByClose) {
    return ok({ node, done: false, skipExpression: false });
  }
  const nextNode = appendChild(
    node,
    hole(loc(origin))
  );
  if (followedByClose) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
  }
  return ok({
    node: nextNode,
    done: followedByClose,
    skipExpression: followedByHole,
  });
};

export const prepareListItem = (
  parserContext: ParserContext,
  node: ChildrenNode,
  origin: NodeLocation
): Result<ListState, TemplateError> => {
  const currentR = peekToken(parserContext);
  if (isErr(currentR)) { return currentR; }
  const current = currentR.value;
  if (isClosingToken(current.type)) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
    return ok({ node, done: true, skipExpression: false });
  }

  if (node.children.length === 0) {
    return ok({ node, done: false, skipExpression: false });
  }

  if (skip(parserContext, TOKEN_COMMA)) {
    return prepareAfterComma(parserContext, node, origin);
  }

  if (!canFollowWithoutComma(current.type)) {
    return fail(parserContext, 'parseAggregate: expected comma after expression', { lineno: current.lineno, colno: current.colno });
  }
  return ok({ node, done: false, skipExpression: false });
};
