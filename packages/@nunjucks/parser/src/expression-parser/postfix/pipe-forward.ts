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

export const parseFilterCallName = (ctx: ParserContext): Node => {
  const tok = expect(ctx, TOKEN_SYMBOL);
  let name = isSymbolToken(tok) ? tok.value : String(tok.value);

  while (skipValue(ctx, TOKEN_OPERATOR, '.')) {
    const sym = expect(ctx, TOKEN_SYMBOL);
    name += `.${isSymbolToken(sym) ? sym.value : String(sym.value)}`;
  }

  return symbol(tok.lineno, tok.colno, name);
};

export const parseFilterCallArgs = (ctx: ParserContext, node: Node): readonly Node[] => {
  if (peekToken(ctx).type === TOKEN_LEFT_PAREN) {
    const call = parsePostfix(ctx, node);
    if (isFunCall(call)) {
      return call.args;
    }
  }
  return [];
};

export const parsePipeForward = (ctx: ParserContext, node: Node): Node => {
  // The parameter stays untouched; `current` carries the growing pipe chain.
  let current = node;

  while (skip(ctx, TOKEN_PIPEFORWARD)) {
    const name = parseFilterCallName(ctx);

    current = pipe(
      name.lineno,
      name.colno,
      name,
      nodeList(
        name.lineno,
        name.colno,
        [current, ...parseFilterCallArgs(ctx, current)]
      ).children
    );
  }

  return current;
};
