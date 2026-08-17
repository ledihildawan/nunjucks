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
import { parsePostfix } from './index.ts';

/** Parses a dotted filter name like `tojson` or `default.attr` into a symbol node. */
export const parseFilterCallName = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tokR = expect(parserContext, TOKEN_SYMBOL);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;
  const initialName = isSymbolToken(tok) ? tok.value : String(tok.value);

  const buildName = (name: string): Result<string, TemplateError> => {
    if (!skipValue(parserContext, TOKEN_OPERATOR, '.')) {
      return ok(name);
    }
    const symR = expect(parserContext, TOKEN_SYMBOL);
    if (isErr(symR)) {
      return symR;
    }
    const sym = symR.value;
    return buildName(`${name}.${isSymbolToken(sym) ? sym.value : String(sym.value)}`);
  };

  const nameR = buildName(initialName);
  if (isErr(nameR)) {
    return nameR;
  }
  return ok(symbol(loc(tok), nameR.value));
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
  if (peekR.value.type === TOKEN_LEFT_PAREN) {
    const callR = parsePostfix(parserContext, node);
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
  const parseLoop = (current: Node): Result<Node, TemplateError> => {
    if (!skip(parserContext, TOKEN_PIPEFORWARD)) {
      return ok(current);
    }
    const nameR = parseFilterCallName(parserContext);
    if (isErr(nameR)) {
      return nameR;
    }
    const argsR = parseFilterCallArgs(parserContext, current);
    if (isErr(argsR)) {
      return argsR;
    }

    return parseLoop(
      // WHY: the Pipe node's loc is the LHS expression's START, not the filter-name
      // token — the html-context tracker classifies the prefix before this position;
      // a filter-name loc makes the prefix contain the `>` of `|>`, defeating
      // open-tag detection and misclassifying unquoted attributes as html context
      // (live attribute-injection vector under autoescape).
      pipe(loc(current), {
        name: nameR.value,
        args: nodeList(loc(nameR.value), [current, ...argsR.value]).children,
      })
    );
  };

  return parseLoop(node);
};
