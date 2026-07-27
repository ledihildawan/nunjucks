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
import { parseExpression } from "../expression-parser/inline.ts";

const isEqualsToken = (ctx: ParserContext): boolean => {
  const tok = peekToken(ctx);
  return tok?.type === TOKEN_OPERATOR && tok.value === '=';
};

const isAssignmentPatternWithEquals = (arg: Node, ctx: ParserContext): boolean =>
  isAssignmentPattern(arg) && isEqualsToken(ctx);

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

  let newArgs = args;
  let newKwargs = kwargs;

  if (isAssignmentPatternWithEquals(arg, ctx)) {
    nextToken(ctx);
    const value = parseExpression(ctx);
    newKwargs = appendChild(kwargs, pair(arg.lineno, arg.colno, arg.target as Node, value));
  } else if (skipValue(ctx, TOKEN_OPERATOR, '=')) {
    newKwargs = appendChild(kwargs, pair(arg.lineno, arg.colno, arg, parseExpression(ctx)));
  } else {
    newArgs = appendChild(args, arg);
  }

  return { args: newArgs, kwargs: newKwargs, checkComma: true };
};

const isNoParensEnd = (tok: ReturnType<typeof peekToken>): boolean =>
  tok?.type === TOKEN_BLOCK_END;

const isParensEnd = (tok: ReturnType<typeof peekToken>): boolean =>
  tok?.type === TOKEN_RIGHT_PAREN;

const shouldContinueParsing = (tok: ReturnType<typeof peekToken>, noParens: boolean | undefined): boolean => {
  if (noParens) { return !isNoParensEnd(tok); }
  return !isParensEnd(tok);
};

const handleSignatureLoopEnd = (ctx: ParserContext, tok: ReturnType<typeof peekToken>, noParens: boolean | undefined): void => {
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
  let tok = peekToken(ctx);
  if (!noParens && tok.type !== TOKEN_LEFT_PAREN) {
    if (tolerant) {
      return null;
    }
      fail(ctx, 'expected arguments', tok.lineno, tok.colno);
  }

  if (tok.type === TOKEN_LEFT_PAREN) {
    tok = nextToken(ctx);
  }

  let args: ChildrenNode = nodeList(tok.lineno, tok.colno);
  let kwargs: ChildrenNode = keywordArgs(tok.lineno, tok.colno);

  const result = parseSignatureLoop(ctx, args, kwargs, noParens);
  args = result.args;
  kwargs = result.kwargs;

  if (kwargs.children.length > 0) {
    args = appendChild(args, kwargs);
  }

  return args;
};
