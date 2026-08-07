import {
  TOKEN_OPERATOR,
  TOKEN_PIPEFORWARD,
  TOKEN_LEFT_PAREN,
  TOKEN_SYMBOL,
  isSymbolToken,
} from '@nunjucks/lexer';
import { isFunCall, nodeList, pipe, symbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skip, skipValue, expect } from "../../cursor.ts";
import type { ParserContext, } from "../../cursor.ts";
import { parsePostfix } from "./index.ts";

export const parseFilterCallName = (parserContext: ParserContext): Node => {
  const tok = expect(parserContext, TOKEN_SYMBOL);
  let name = isSymbolToken(tok) ? tok.value : String(tok.value);

  while (skipValue(parserContext, TOKEN_OPERATOR, '.')) {
    const sym = expect(parserContext, TOKEN_SYMBOL);
    name += `.${isSymbolToken(sym) ? sym.value : String(sym.value)}`;
  }

  return symbol(tok.lineno, tok.colno, name);
};

export const parseFilterCallArgs = (parserContext: ParserContext, node: Node): readonly Node[] => {
  if (peekToken(parserContext).type === TOKEN_LEFT_PAREN) {
    const call = parsePostfix(parserContext, node);
    if (isFunCall(call)) {
      return call.args;
    }
  }
  return [];
};

export const parsePipeForward = (parserContext: ParserContext, node: Node): Node => {
  let current = node;

  while (skip(parserContext, TOKEN_PIPEFORWARD)) {
    const name = parseFilterCallName(parserContext);

    current = pipe(
      name.lineno,
      name.colno,
      name,
      nodeList(
        name.lineno,
        name.colno,
        [current, ...parseFilterCallArgs(parserContext, current)]
      ).children
    );
  }

  return current;
};
