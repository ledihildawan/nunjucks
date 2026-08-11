import {
  TOKEN_OPERATOR,
  TOKEN_PIPEFORWARD,
  TOKEN_LEFT_PAREN,
  TOKEN_SYMBOL,
  isSymbolToken,
} from '@nunjucks/lexer';
import { isFunCall, nodeList, pipe, symbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { peekToken, skip, skipValue, expect } from "../../cursor.ts";
import type { ParserContext, } from "../../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/lib';
import { parsePostfix } from "./index.ts";
import { loc } from '@nunjucks/shared';

export const parseFilterCallName = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tokR = expect(parserContext, TOKEN_SYMBOL);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;
  const initialName = isSymbolToken(tok) ? tok.value : String(tok.value);

  const buildName = (name: string): Result<string, TemplateError> => {
    if (!skipValue(parserContext, TOKEN_OPERATOR, '.')) { return ok(name); }
    const symR = expect(parserContext, TOKEN_SYMBOL);
    if (isErr(symR)) { return symR; }
    const sym = symR.value;
    return buildName(`${name}.${isSymbolToken(sym) ? sym.value : String(sym.value)}`);
  };

  const nameR = buildName(initialName);
  if (isErr(nameR)) { return nameR; }
  return ok(symbol(loc(tok), nameR.value));
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
  const parseLoop = (current: Node): Result<Node, TemplateError> => {
    if (!skip(parserContext, TOKEN_PIPEFORWARD)) { return ok(current); }
    const nameR = parseFilterCallName(parserContext);
    if (isErr(nameR)) { return nameR; }
    const argsR = parseFilterCallArgs(parserContext, current);
    if (isErr(argsR)) { return argsR; }

    return parseLoop(
      pipe(
        loc(nameR.value),
        {
          name: nameR.value,
          args: nodeList(
            loc(nameR.value),
            [current, ...argsR.value]
          ).children,
        }
      )
    );
  };

  return parseLoop(node);
};
