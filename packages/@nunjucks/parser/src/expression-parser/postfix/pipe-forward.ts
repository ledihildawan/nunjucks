import {
  TOKEN_OPERATOR,
  TOKEN_PIPEFORWARD,
  TOKEN_LEFT_PAREN,
  TOKEN_SYMBOL,
  isSymbolToken,
} from '@nunjucks/lexer';
import { isFunCall, nodeList, pipe, symbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import { peekToken, skip, skipValue, expect } from "../../cursor.ts";
import type { ParserContext, } from "../../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/shared';
import { parsePostfix } from "./index.ts";
import { loc } from '@nunjucks/shared';

export const parseFilterCallName = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tokR = expect(parserContext, TOKEN_SYMBOL);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;
  let name = isSymbolToken(tok) ? tok.value : String(tok.value);

  while (skipValue(parserContext, TOKEN_OPERATOR, '.')) {
    const symR = expect(parserContext, TOKEN_SYMBOL);
    if (isErr(symR)) { return symR; }
    const sym = symR.value;
    name += `.${isSymbolToken(sym) ? sym.value : String(sym.value)}`;
  }

  return ok(symbol(loc(tok), name));
};

export const parseFilterCallArgs = (parserContext: ParserContext, node: Node): Result<readonly Node[], TemplateError> => {
  const peekR = peekToken(parserContext);
  if (isErr(peekR)) { return peekR; }
  if (peekR.value.type === TOKEN_LEFT_PAREN) {
    const callR = parsePostfix(parserContext, node);
    if (isErr(callR)) { return callR; }
    if (isFunCall(callR.value)) {
      return ok(callR.value.args);
    }
  }
  return ok([]);
};

export const parsePipeForward = (parserContext: ParserContext, node: Node): Result<Node, TemplateError> => {
  let current = node;

  while (skip(parserContext, TOKEN_PIPEFORWARD)) {
    const nameR = parseFilterCallName(parserContext);
    if (isErr(nameR)) { return nameR; }
    const argsR = parseFilterCallArgs(parserContext, current);
    if (isErr(argsR)) { return argsR; }

    current = pipe(
      loc(nameR.value),
      {
        name: nameR.value,
        args: nodeList(
          loc(nameR.value),
          [current, ...argsR.value]
        ).children,
      }
    );
  }

  return ok(current);
};
