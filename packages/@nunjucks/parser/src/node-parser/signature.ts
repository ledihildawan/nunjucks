import type { TemplateError } from '@nunjucks/error-formatter';
import type { Token } from '@nunjucks/lexer';
import {
  TOKEN_BLOCK_END,
  TOKEN_COMMA,
  TOKEN_LEFT_PAREN,
  TOKEN_OPERATOR,
  TOKEN_RIGHT_PAREN,
} from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import { appendChild, isAssignmentPattern, keywordArgs, nodeList, pair } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { fail, nextToken, peekToken, peekTokenOrNull, skip, skipValue } from '../cursor.ts';
import { parseExpression } from '../expression-parser/index.ts';

interface SignatureArgState {
  args: ChildrenNode;
  kwargs: ChildrenNode;
  checkComma: boolean;
}

const isEqualsToken = (parserContext: ParserContext): boolean => {
  const tok = peekTokenOrNull(parserContext);
  return tok?.type === TOKEN_OPERATOR && tok.value === '=';
};

interface ParseSignatureArgOptions {
  parserContext: ParserContext;
  args: ChildrenNode;
  kwargs: ChildrenNode;
  checkComma: boolean;
}

const parseSignatureArg = ({
  parserContext,
  args,
  kwargs,
  checkComma,
}: ParseSignatureArgOptions): Result<SignatureArgState, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;
  if (checkComma && !skip(parserContext, TOKEN_COMMA)) {
    return fail(parserContext, 'parseSignature: expected comma after expression', {
      lineno: tok.lineno,
      colno: tok.colno,
    });
  }

  const argumentR = parseExpression(parserContext);
  if (isErr(argumentR)) {
    return argumentR;
  }
  const argument = argumentR.value;

  if (isAssignmentPattern(argument) && isEqualsToken(parserContext)) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
    const valueR = parseExpression(parserContext);
    if (isErr(valueR)) {
      return valueR;
    }
    return ok({
      args,
      kwargs: appendChild(kwargs, pair(loc(argument), { key: argument.target, val: valueR.value })),
      checkComma: true,
    });
  }
  if (skipValue(parserContext, TOKEN_OPERATOR, '=')) {
    const valueR = parseExpression(parserContext);
    if (isErr(valueR)) {
      return valueR;
    }
    return ok({
      args,
      kwargs: appendChild(kwargs, pair(loc(argument), { key: argument, val: valueR.value })),
      checkComma: true,
    });
  }
  return ok({ args: appendChild(args, argument), kwargs, checkComma: true });
};

const isNoParensEnd = (tok: Token): boolean => tok?.type === TOKEN_BLOCK_END;

const isParensEnd = (tok: Token): boolean => tok?.type === TOKEN_RIGHT_PAREN;

interface ParseSignatureLoopOptions {
  parserContext: ParserContext;
  args: ChildrenNode;
  kwargs: ChildrenNode;
  noParens: boolean | undefined;
}

const parseSignatureLoop = ({
  parserContext,
  args,
  kwargs,
  noParens,
}: ParseSignatureLoopOptions): Result<
  { args: ChildrenNode; kwargs: ChildrenNode },
  TemplateError
> => {
  const isLoopEnd = (tok: Token): boolean => (noParens ? isNoParensEnd(tok) : isParensEnd(tok));

  const consumeLoopEnd = (tok: Token): Result<void, TemplateError> => {
    if (!noParens && tok?.type === TOKEN_RIGHT_PAREN) {
      const consumedR = nextToken(parserContext);
      if (isErr(consumedR)) {
        return consumedR;
      }
    }
    return ok(undefined);
  };

  const parseLoop = (
    currentArgs: ChildrenNode,
    currentKwargs: ChildrenNode,
    checkComma: boolean
  ): Result<{ args: ChildrenNode; kwargs: ChildrenNode }, TemplateError> => {
    const tokR = peekToken(parserContext);
    if (isErr(tokR)) {
      return tokR;
    }
    const tok = tokR.value;
    if (isLoopEnd(tok)) {
      const endR = consumeLoopEnd(tok);
      if (isErr(endR)) {
        return endR;
      }
      return ok({ args: currentArgs, kwargs: currentKwargs });
    }

    const result = parseSignatureArg({
      parserContext,
      args: currentArgs,
      kwargs: currentKwargs,
      checkComma,
    });
    if (isErr(result)) {
      return result;
    }
    return parseLoop(result.value.args, result.value.kwargs, result.value.checkComma);
  };

  return parseLoop(args, kwargs, false);
};

export interface ParseSignatureOptions {
  parserContext: ParserContext;
  tolerant?: boolean;
  noParens?: boolean;
}

export const parseSignature = ({
  parserContext,
  tolerant = false,
  noParens = false,
}: ParseSignatureOptions): Result<Node | null, TemplateError> => {
  const initialTokR = peekToken(parserContext);
  if (isErr(initialTokR)) {
    return initialTokR;
  }
  const initialTok = initialTokR.value;
  if (!noParens && initialTok.type !== TOKEN_LEFT_PAREN) {
    if (tolerant) {
      return ok(null);
    }
    return fail(parserContext, 'expected arguments', {
      lineno: initialTok.lineno,
      colno: initialTok.colno,
    });
  }

  let tok: Token;
  if (initialTok.type === TOKEN_LEFT_PAREN) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
    tok = consumedR.value;
  } else {
    tok = initialTok;
  }

  const loopR = parseSignatureLoop({
    parserContext,
    args: nodeList(loc(tok)),
    kwargs: keywordArgs(loc(tok)),
    noParens,
  });
  if (isErr(loopR)) {
    return loopR;
  }
  const args =
    loopR.value.kwargs.children.length > 0
      ? appendChild(loopR.value.args, loopR.value.kwargs)
      : loopR.value.args;

  return ok(args);
};
