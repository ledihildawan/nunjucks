import type { TemplateError } from '@nunjucks/error-formatter';
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
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node, NodeLocation } from '@nunjucks/nodes';
import { hole } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../../cursor.ts';
import { fail, nextToken, peekToken, skip } from '../../cursor.ts';

interface ListState {
  hole: Node | null;
  done: boolean;
  skipExpression: boolean;
}

const isClosingToken = (type: string): boolean =>
  type === TOKEN_RIGHT_PAREN || type === TOKEN_RIGHT_BRACKET || type === TOKEN_RIGHT_CURLY;

const canFollowWithoutComma = (type: string): boolean =>
  type === TOKEN_SYMBOL ||
  type === TOKEN_LEFT_BRACKET ||
  type === TOKEN_LEFT_CURLY ||
  type === TOKEN_LEFT_PAREN;

const prepareAfterComma = (
  parserContext: ParserContext,
  origin: NodeLocation
): Result<ListState, TemplateError> => {
  const afterCommaR = peekToken(parserContext);
  if (isErr(afterCommaR)) {
    return afterCommaR;
  }
  const afterComma = afterCommaR.value.type;
  const followedByHole = afterComma === TOKEN_COMMA;
  const followedByClose = afterComma === TOKEN_RIGHT_BRACKET || afterComma === TOKEN_RIGHT_PAREN;
  if (!followedByHole && !followedByClose) {
    return ok({ hole: null, done: false, skipExpression: false });
  }
  if (followedByClose) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
  }
  return ok({
    hole: hole(loc(origin)),
    done: followedByClose,
    skipExpression: followedByHole,
  });
};

export const prepareListItem = (
  parserContext: ParserContext,
  hasItems: boolean,
  origin: NodeLocation
): Result<ListState, TemplateError> => {
  const currentR = peekToken(parserContext);
  if (isErr(currentR)) {
    return currentR;
  }
  const current = currentR.value;
  if (isClosingToken(current.type)) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
    return ok({ hole: null, done: true, skipExpression: false });
  }

  if (!hasItems) {
    return ok({ hole: null, done: false, skipExpression: false });
  }

  if (skip(parserContext, TOKEN_COMMA)) {
    return prepareAfterComma(parserContext, origin);
  }

  if (!canFollowWithoutComma(current.type)) {
    return fail(parserContext, {
      message: 'parseAggregate: expected comma after expression',
      lineno: current.lineno,
      colno: current.colno,
    });
  }
  return ok({ hole: null, done: false, skipExpression: false });
};
