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
import { nextToken, peekToken, skip, skipValue, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";

const isEqualsToken = (ctx: ParserContext): boolean => {
  const tok = peekToken(ctx);
  return tok?.type === TOKEN_OPERATOR && tok.value === '=';
};

const parseSignatureArg = (
  ctx: ParserContext,
  args: ChildrenNode,
  kwargs: ChildrenNode,
  checkComma: boolean
): { args: ChildrenNode; kwargs: ChildrenNode; checkComma: boolean } | null => {
  const tok = peekToken(ctx);
  if (checkComma && !skip(ctx, TOKEN_COMMA)) {
    fail(ctx, 'parseSignature: expected comma after expression', tok.lineno, tok.colno);
    return null;
  }

  const arg = parseExpression(ctx);

  if (isAssignmentPattern(arg) && isEqualsToken(ctx)) {
    nextToken(ctx);
    const value = parseExpression(ctx);
    return { args, kwargs: appendChild(kwargs, pair(arg.lineno, arg.colno, arg.target, value)), checkComma: true };
  }
  if (skipValue(ctx, TOKEN_OPERATOR, '=')) {
    return { args, kwargs: appendChild(kwargs, pair(arg.lineno, arg.colno, arg, parseExpression(ctx))), checkComma: true };
  }
  return { args: appendChild(args, arg), kwargs, checkComma: true };
};

const isNoParensEnd = (tok: Token): boolean =>
  tok?.type === TOKEN_BLOCK_END;

const isParensEnd = (tok: Token): boolean =>
  tok?.type === TOKEN_RIGHT_PAREN;

const shouldContinueParsing = (tok: Token, noParens: boolean | undefined): boolean => {
  if (noParens) { return !isNoParensEnd(tok); }
  return !isParensEnd(tok);
};

const handleSignatureLoopEnd = (ctx: ParserContext, tok: Token, noParens: boolean | undefined): void => {
  if (!noParens && tok?.type === TOKEN_RIGHT_PAREN) {
    nextToken(ctx);
  }
};

const parseSignatureLoop = (
  ctx: ParserContext,
  args: ChildrenNode,
  kwargs: ChildrenNode,
  noParens: boolean | undefined
): { args: ChildrenNode; kwargs: ChildrenNode } => {
  let checkComma = false;
  let currentArgs = args;
  let currentKwargs = kwargs;

  for (;;) {
    const tok = peekToken(ctx);
    if (!shouldContinueParsing(tok, noParens)) {
      handleSignatureLoopEnd(ctx, tok, noParens);
      break;
    }

    const result = parseSignatureArg(ctx, currentArgs, currentKwargs, checkComma);
    if (!result) { break; }
    currentArgs = result.args;
    currentKwargs = result.kwargs;
    checkComma = result.checkComma;
  }

  return { args: currentArgs, kwargs: currentKwargs };
};

export const parseSignature = (ctx: ParserContext, tolerant?: boolean, noParens?: boolean): Node | null => {
  const initialTok = peekToken(ctx);
  if (!noParens && initialTok.type !== TOKEN_LEFT_PAREN) {
    if (tolerant) {
      return null;
    }
    fail(ctx, 'expected arguments', initialTok.lineno, initialTok.colno);
  }

  const tok = initialTok.type === TOKEN_LEFT_PAREN ? nextToken(ctx) : initialTok;

  const loopResult = parseSignatureLoop(ctx, nodeList(tok.lineno, tok.colno), keywordArgs(tok.lineno, tok.colno), noParens);
  const args = loopResult.kwargs.children.length > 0
    ? appendChild(loopResult.args, loopResult.kwargs)
    : loopResult.args;

  return args;
};
