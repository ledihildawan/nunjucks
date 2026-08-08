import type { Token } from '@nunjucks/lexer';
import {
  TOKEN_BLOCK_END,
  TOKEN_COMMA,
  TOKEN_LEFT_PAREN,
  TOKEN_OPERATOR,
  TOKEN_RIGHT_PAREN,
} from '@nunjucks/lexer';
import { appendChild, isAssignmentPattern, keywordArgs, nodeList, pair } from '@nunjucks/nodes';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import { nextToken, peekToken, peekTokenOrNull, skip, skipValue, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/shared';
import { parseExpression } from "../expression-parser/index.ts";
import { loc } from '@nunjucks/shared';

interface SignatureArgState {
  args: ChildrenNode;
  kwargs: ChildrenNode;
  checkComma: boolean;
}

const isEqualsToken = (parserContext: ParserContext): boolean => {
  const tok = peekTokenOrNull(parserContext);
  return tok?.type === TOKEN_OPERATOR && tok.value === '=';
};

const parseSignatureArg = (
  parserContext: ParserContext,
  args: ChildrenNode,
  kwargs: ChildrenNode,
  checkComma: boolean
): Result<SignatureArgState, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;
  if (checkComma && !skip(parserContext, TOKEN_COMMA)) {
    return fail(parserContext, 'parseSignature: expected comma after expression', tok.lineno, tok.colno);
  }

  const argumentR = parseExpression(parserContext);
  if (isErr(argumentR)) { return argumentR; }
  const argument = argumentR.value;

  if (isAssignmentPattern(argument) && isEqualsToken(parserContext)) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
    const valueR = parseExpression(parserContext);
    if (isErr(valueR)) { return valueR; }
    return ok({ args, kwargs: appendChild(kwargs, pair(loc(argument), { key: argument.target, val: valueR.value })), checkComma: true });
  }
  if (skipValue(parserContext, TOKEN_OPERATOR, '=')) {
    const valueR = parseExpression(parserContext);
    if (isErr(valueR)) { return valueR; }
    return ok({ args, kwargs: appendChild(kwargs, pair(loc(argument), { key: argument, val: valueR.value })), checkComma: true });
  }
  return ok({ args: appendChild(args, argument), kwargs, checkComma: true });
};

const isNoParensEnd = (tok: Token): boolean =>
  tok?.type === TOKEN_BLOCK_END;

const isParensEnd = (tok: Token): boolean =>
  tok?.type === TOKEN_RIGHT_PAREN;

const shouldContinueParsing = (tok: Token, noParens: boolean | undefined): boolean => {
  if (noParens) { return !isNoParensEnd(tok); }
  return !isParensEnd(tok);
};

const handleSignatureLoopEnd = (parserContext: ParserContext, tok: Token, noParens: boolean | undefined): Result<void, TemplateError> => {
  if (!noParens && tok?.type === TOKEN_RIGHT_PAREN) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
  }
  return ok(undefined);
};

const parseSignatureLoop = (
  parserContext: ParserContext,
  args: ChildrenNode,
  kwargs: ChildrenNode,
  noParens: boolean | undefined
): Result<{ args: ChildrenNode; kwargs: ChildrenNode }, TemplateError> => {
  const parseLoop = (
    currentArgs: ChildrenNode,
    currentKwargs: ChildrenNode,
    checkComma: boolean
  ): Result<{ args: ChildrenNode; kwargs: ChildrenNode }, TemplateError> => {
    const tokR = peekToken(parserContext);
    if (isErr(tokR)) { return tokR; }
    const tok = tokR.value;
    if (!shouldContinueParsing(tok, noParens)) {
      const endR = handleSignatureLoopEnd(parserContext, tok, noParens);
      if (isErr(endR)) { return endR; }
      return ok({ args: currentArgs, kwargs: currentKwargs });
    }

    const result = parseSignatureArg(parserContext, currentArgs, currentKwargs, checkComma);
    if (isErr(result)) { return result; }
    return parseLoop(result.value.args, result.value.kwargs, result.value.checkComma);
  };

  return parseLoop(args, kwargs, false);
};

export const parseSignature = (parserContext: ParserContext, tolerant?: boolean, noParens?: boolean): Result<Node | null, TemplateError> => {
  const initialTokR = peekToken(parserContext);
  if (isErr(initialTokR)) { return initialTokR; }
  const initialTok = initialTokR.value;
  if (!noParens && initialTok.type !== TOKEN_LEFT_PAREN) {
    if (tolerant) {
      return ok(null);
    }
    return fail(parserContext, 'expected arguments', initialTok.lineno, initialTok.colno);
  }

  let tok: Token;
  if (initialTok.type === TOKEN_LEFT_PAREN) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
    tok = consumedR.value;
  } else {
    tok = initialTok;
  }

  const loopR = parseSignatureLoop(parserContext, nodeList(loc(tok)), keywordArgs(loc(tok)), noParens);
  if (isErr(loopR)) { return loopR; }
  const args = loopR.value.kwargs.children.length > 0
    ? appendChild(loopR.value.args, loopR.value.kwargs)
    : loopR.value.args;

  return ok(args);
};
