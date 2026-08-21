import type { TemplateError } from '@nunjucks/error-formatter';
import {
  isSymbolToken,
  TOKEN_LEFT_PAREN,
  TOKEN_OPERATOR,
  TOKEN_PIPEFORWARD,
  TOKEN_SYMBOL,
} from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { isFunCall, nodeList, pipe, symbol } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../../cursor.ts';
import { expect, peekToken, skip, skipValue } from '../../cursor.ts';
import { parseFunCall } from './fun-call.ts';

/** Parses a dotted filter name like `tojson` or `default.attr` into a symbol node. */
export const parseFilterCallName = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tokR = expect(parserContext, TOKEN_SYMBOL);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;
  const initialName = isSymbolToken(tok) ? tok.value : String(tok.value);

  let name = initialName;
  // WHY: iterative loop (parser loop exemption) — the recursive buildName recursed once
  // per dot segment, so a pathological `f.a.b.c...` filter name overflowed the stack.
  while (skipValue(parserContext, TOKEN_OPERATOR, '.')) {
    const symR = expect(parserContext, TOKEN_SYMBOL);
    if (isErr(symR)) {
      return symR;
    }
    const sym = symR.value;
    name = `${name}.${isSymbolToken(sym) ? sym.value : String(sym.value)}`;
  }
  return ok(symbol(loc(tok), name));
};

/** Parses a filter's parenthesized argument list when present, otherwise returns `[]`. */
export const parseFilterCallArgs = (
  parserContext: ParserContext,
  node: Node
): Result<readonly Node[], TemplateError> => {
  const peekR = peekToken(parserContext);
  if (isErr(peekR)) {
    return peekR;
  }
  const tok = peekR.value;
  if (tok.type === TOKEN_LEFT_PAREN) {
    // WHY: parseFunCall is invoked directly — routing through parsePostfix would import
    // the ./index.ts barrel, which re-exports this module and closes a module cycle.
    const callR = parseFunCall(parserContext, tok, node);
    if (isErr(callR)) {
      return callR;
    }
    if (isFunCall(callR.value)) {
      return ok(callR.value.args);
    }
  }
  return ok([]);
};

/**
 * Parses `|>` pipe-forward chains, folding each filter call so the value
 * flows left-to-right; each `Pipe` loc is the LHS start, not the operator.
 */
export const parsePipeForward = (
  parserContext: ParserContext,
  node: Node
): Result<Node, TemplateError> => {
  // WHY: iterative loop (parser loop exemption) — the recursive loop recursed once per
  // `|>` segment, so `a |> f |> f...` overflowed the stack on long filter chains.
  let current = node;
  while (skip(parserContext, TOKEN_PIPEFORWARD)) {
    const nameR = parseFilterCallName(parserContext);
    if (isErr(nameR)) {
      return nameR;
    }
    const argsR = parseFilterCallArgs(parserContext, current);
    if (isErr(argsR)) {
      return argsR;
    }

    // WHY: the Pipe node's loc is the LHS expression's START, not the filter-name
    // token — the html-context tracker classifies the prefix before this position;
    // a filter-name loc makes the prefix contain the `>` of `|>`, defeating
    // open-tag detection and misclassifying unquoted attributes as html context
    // (live attribute-injection vector under autoescape).
    current = pipe(loc(current), {
      name: nameR.value,
      args: nodeList(loc(nameR.value), [current, ...argsR.value]).children,
    });
  }

  return ok(current);
};
