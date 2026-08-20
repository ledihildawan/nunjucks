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

interface SignatureArgState {
  args: Node[];
  kwargs: Node[];
  checkComma: boolean;
}

const isEqualsToken = (parserContext: ParserContext): boolean => {
  const tok = peekTokenOrNull(parserContext);
  return tok?.type === TOKEN_OPERATOR && tok.value === '=';
};

interface ParseSignatureArgOptions {
  parserContext: ParserContext;
  args: Node[];
  kwargs: Node[];
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
    return fail(parserContext, {
      message: 'parseSignature: expected comma after expression',
      lineno: tok.lineno,
      colno: tok.colno,
    });
  }

  const argumentR = parserContext.parseExpression();
  if (isErr(argumentR)) {
    return argumentR;
  }
  const argument = argumentR.value;

  if (isAssignmentPattern(argument) && isEqualsToken(parserContext)) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
    const valueR = parserContext.parseExpression();
    if (isErr(valueR)) {
      return valueR;
    }
    kwargs.push(pair(loc(argument), { key: argument.target, val: valueR.value }));
    return ok({ args, kwargs, checkComma: true });
  }
  if (skipValue(parserContext, TOKEN_OPERATOR, '=')) {
    const valueR = parserContext.parseExpression();
    if (isErr(valueR)) {
      return valueR;
    }
    kwargs.push(pair(loc(argument), { key: argument, val: valueR.value }));
    return ok({ args, kwargs, checkComma: true });
  }
  args.push(argument);
  return ok({ args, kwargs, checkComma: true });
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

  // WHY: iterative loop with local accumulators (parser loop exemption) — the recursive
  // loop recursed once per argument and threaded each one through the copying
  // appendChild (O(n²)), so `f(a,a,...)` overflowed the stack and crawled on
  // argument-count-long calls.
  const argChildren: Node[] = [];
  const kwargChildren: Node[] = [];
  let checkComma = false;
  while (true) {
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
      return ok({
        args: { ...args, children: argChildren },
        kwargs: { ...kwargs, children: kwargChildren },
      });
    }

    const result = parseSignatureArg({
      parserContext,
      args: argChildren,
      kwargs: kwargChildren,
      checkComma,
    });
    if (isErr(result)) {
      return result;
    }
    checkComma = result.value.checkComma;
  }
};

interface ParseSignatureOptions {
  parserContext: ParserContext;
  tolerant?: boolean;
  noParens?: boolean;
}

/**
 * Parses a call signature: a parenthesized `(a, b=1, ...)` argument list,
 * or — with `noParens` — arguments running directly to the block end.
 * Positional and keyword arguments accumulate into one children node,
 * with `tolerant` returning `null` when no `(` is present.
 */
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
    return fail(parserContext, {
      message: 'expected arguments',
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
