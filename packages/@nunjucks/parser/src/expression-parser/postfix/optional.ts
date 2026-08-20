import type { TemplateError } from '@nunjucks/error-formatter';
import type { Token } from '@nunjucks/lexer';
import {
  TOKEN_COMMA,
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_PAREN,
  type TOKEN_OPERATOR,
  TOKEN_RIGHT_PAREN,
  TOKEN_SYMBOL,
} from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import { literal, nodeList, optionalCall, optionalChain } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../../cursor.ts';
import { fail, nextToken, peekToken } from '../../cursor.ts';
import { parseExpression } from '../index.ts';
import { markAsBracket, markAsDot } from './lookup.ts';

type OptionalChainOperatorToken = Token & { type: typeof TOKEN_OPERATOR };

const isEndOfArgs = (next: Token): boolean => !next || next.type === TOKEN_RIGHT_PAREN;

const skipOptionalArgComma = (
  parserContext: ParserContext,
  next: Token,
  expectComma: boolean
): Result<void, TemplateError> => {
  if (!expectComma) {
    return ok(undefined);
  }
  if (next.type !== TOKEN_COMMA) {
    return fail(parserContext, {
      message: 'expected comma after expression',
      lineno: next.lineno ?? 0,
      colno: next.colno ?? 0,
    });
  }
  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) {
    return consumedR;
  }
  return ok(undefined);
};

const consumeOptionalArgsEnd = (
  parserContext: ParserContext,
  next: Token
): Result<void, TemplateError> => {
  if (next) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
  }
  return ok(undefined);
};

const parseOptionalCallArgs = (
  parserContext: ParserContext,
  tok: Token
): Result<ChildrenNode, TemplateError> => {
  // WHY: iterative loop with a local accumulator (parser loop exemption) — the recursive
  // loop recursed once per argument and threaded each one through the copying
  // appendChild (O(n²)), so `a?.(a,a,...)` overflowed the stack and crawled on
  // argument-count-long lists.
  const children: Node[] = [];
  let expectComma = false;
  while (true) {
    const nextR = peekToken(parserContext);
    if (isErr(nextR)) {
      return nextR;
    }
    const next = nextR.value;

    if (isEndOfArgs(next)) {
      const endR = consumeOptionalArgsEnd(parserContext, next);
      if (isErr(endR)) {
        return endR;
      }
      return ok(nodeList(loc(tok), children));
    }

    const commaR = skipOptionalArgComma(parserContext, next, expectComma);
    if (isErr(commaR)) {
      return commaR;
    }

    const argumentR = parseExpression(parserContext);
    if (isErr(argumentR)) {
      return argumentR;
    }
    children.push(argumentR.value);
    expectComma = true;
  }
};

const parseOptionalCall = (
  parserContext: ParserContext,
  tok: Token,
  target: Node
): Result<Node, TemplateError> => {
  const consumedParenR = nextToken(parserContext);
  if (isErr(consumedParenR)) {
    return consumedParenR;
  }
  const argsR = parseOptionalCallArgs(parserContext, tok);
  if (isErr(argsR)) {
    return argsR;
  }
  return ok(optionalCall(loc(tok), { name: target, args: [...argsR.value.children] }));
};

const parseOptionalBracket = (
  parserContext: ParserContext,
  tok: Token,
  target: Node
): Result<Node, TemplateError> => {
  const consumedBracketR = nextToken(parserContext);
  if (isErr(consumedBracketR)) {
    return consumedBracketR;
  }
  const startR = parseExpression(parserContext);
  if (isErr(startR)) {
    return startR;
  }

  const rightBracketR = nextToken(parserContext);
  if (isErr(rightBracketR)) {
    return rightBracketR;
  }
  if (rightBracketR.value.type !== 'right-bracket') {
    return fail(parserContext, {
      message: 'expected right bracket',
      lineno: rightBracketR.value.lineno,
      colno: rightBracketR.value.colno,
    });
  }

  const node = optionalChain(loc(tok), { target, val: startR.value });
  markAsBracket(node);
  return ok(node);
};

const parseOptionalLookup = (
  parserContext: ParserContext,
  tok: Token,
  target: Node
): Result<Node, TemplateError> => {
  const nameTokR = nextToken(parserContext);
  if (isErr(nameTokR)) {
    return nameTokR;
  }
  const nameTok = nameTokR.value;

  if (nameTok.type !== TOKEN_SYMBOL) {
    const targetName = target ? String(target.value ?? 'expression') : 'expression';
    return fail(parserContext, {
      message: `expected name as lookup value after ?. on ${targetName}, got ${nameTok.value}`,
      lineno: nameTok.lineno,
      colno: nameTok.colno,
    });
  }

  const lookup = literal(loc(nameTok), nameTok.value);
  const node = optionalChain(loc(tok), { target, val: lookup });
  markAsDot(node);
  return ok(node);
};

/**
 * Parses the segment after a consumed `?.` operator: a call `?.(...)`,
 * bracket access `?.[...]`, or short property lookup `?.name`, building
 * an optional-chain node and carrying over bracket/dot notation marks.
 */
export const parseOptionalChain = (
  parserContext: ParserContext,
  tok: OptionalChainOperatorToken,
  target: Node
): Result<Node, TemplateError> => {
  const consumedOpR = nextToken(parserContext);
  if (isErr(consumedOpR)) {
    return consumedOpR;
  }
  const valueR = peekToken(parserContext);
  if (isErr(valueR)) {
    return valueR;
  }
  const value = valueR.value;

  if (value.type === TOKEN_LEFT_PAREN) {
    return parseOptionalCall(parserContext, tok, target);
  }
  if (value.type === TOKEN_LEFT_BRACKET) {
    return parseOptionalBracket(parserContext, tok, target);
  }
  return parseOptionalLookup(parserContext, tok, target);
};
