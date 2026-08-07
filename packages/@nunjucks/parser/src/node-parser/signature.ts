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

const isEqualsToken = (parserContext: ParserContext): boolean => {
  const tok = peekToken(parserContext);
  return tok?.type === TOKEN_OPERATOR && tok.value === '=';
};

const parseSignatureArg = (
  parserContext: ParserContext,
  args: ChildrenNode,
  kwargs: ChildrenNode,
  checkComma: boolean
): { args: ChildrenNode; kwargs: ChildrenNode; checkComma: boolean } | null => {
  const tok = peekToken(parserContext);
  if (checkComma && !skip(parserContext, TOKEN_COMMA)) {
    fail(parserContext, 'parseSignature: expected comma after expression', tok.lineno, tok.colno);
    return null;
  }

  const argument = parseExpression(parserContext);

  if (isAssignmentPattern(argument) && isEqualsToken(parserContext)) {
    nextToken(parserContext);
    const value = parseExpression(parserContext);
    return { args, kwargs: appendChild(kwargs, pair(argument.lineno, argument.colno, argument.target, value)), checkComma: true };
  }
  if (skipValue(parserContext, TOKEN_OPERATOR, '=')) {
    return { args, kwargs: appendChild(kwargs, pair(argument.lineno, argument.colno, argument, parseExpression(parserContext))), checkComma: true };
  }
  return { args: appendChild(args, argument), kwargs, checkComma: true };
};

const isNoParensEnd = (tok: Token): boolean =>
  tok?.type === TOKEN_BLOCK_END;

const isParensEnd = (tok: Token): boolean =>
  tok?.type === TOKEN_RIGHT_PAREN;

const shouldContinueParsing = (tok: Token, noParens: boolean | undefined): boolean => {
  if (noParens) { return !isNoParensEnd(tok); }
  return !isParensEnd(tok);
};

const handleSignatureLoopEnd = (parserContext: ParserContext, tok: Token, noParens: boolean | undefined): void => {
  if (!noParens && tok?.type === TOKEN_RIGHT_PAREN) {
    nextToken(parserContext);
  }
};

const parseSignatureLoop = (
  parserContext: ParserContext,
  args: ChildrenNode,
  kwargs: ChildrenNode,
  noParens: boolean | undefined
): { args: ChildrenNode; kwargs: ChildrenNode } => {
  let checkComma = false;
  let currentArgs = args;
  let currentKwargs = kwargs;

  for (;;) {
    const tok = peekToken(parserContext);
    if (!shouldContinueParsing(tok, noParens)) {
      handleSignatureLoopEnd(parserContext, tok, noParens);
      break;
    }

    const result = parseSignatureArg(parserContext, currentArgs, currentKwargs, checkComma);
    if (!result) { break; }
    currentArgs = result.args;
    currentKwargs = result.kwargs;
    checkComma = result.checkComma;
  }

  return { args: currentArgs, kwargs: currentKwargs };
};

export const parseSignature = (parserContext: ParserContext, tolerant?: boolean, noParens?: boolean): Node | null => {
  const initialTok = peekToken(parserContext);
  if (!noParens && initialTok.type !== TOKEN_LEFT_PAREN) {
    if (tolerant) {
      return null;
    }
    fail(parserContext, 'expected arguments', initialTok.lineno, initialTok.colno);
  }

  const tok = initialTok.type === TOKEN_LEFT_PAREN ? nextToken(parserContext) : initialTok;

  const loopResult = parseSignatureLoop(parserContext, nodeList(tok.lineno, tok.colno), keywordArgs(tok.lineno, tok.colno), noParens);
  const args = loopResult.kwargs.children.length > 0
    ? appendChild(loopResult.args, loopResult.kwargs)
    : loopResult.args;

  return args;
};
