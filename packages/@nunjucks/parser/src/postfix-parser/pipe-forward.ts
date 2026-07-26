import {
  TOKEN_OPERATOR,
  TOKEN_PIPEFORWARD,
  TOKEN_LEFT_PAREN,
  TOKEN_SYMBOL,
} from '@nunjucks/lexer';
import { isFunCall, nodeList, pipe, symbol } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skip, skipValue, expect } from "../cursor.ts";
import type { ParserContext, } from "../cursor.ts";
import { parsePostfix } from "./index.ts";

export const parseFilterCallName = (ctx: ParserContext): Node => {
  const tok = expect(ctx, TOKEN_SYMBOL);
  let name = tok.value as string;

  while (skipValue(ctx, TOKEN_OPERATOR, '.')) {
    name += `.${expect(ctx, TOKEN_SYMBOL).value as string}`;
  }

  return symbol(tok.lineno, tok.colno, name);
};

export const parseFilterCallArgs = (ctx: ParserContext, node: Node): Node[] => {
  if (peekToken(ctx).type === TOKEN_LEFT_PAREN) {
    const call = parsePostfix(ctx, node);
    if (isFunCall(call)) {
      return call.args;
    }
  }
  return [];
};

export const parsePipeForward = (ctx: ParserContext, node: Node): Node => {
  while (skip(ctx, TOKEN_PIPEFORWARD)) {
    const name = parseFilterCallName(ctx);

    node = pipe(
      name.lineno,
      name.colno,
      name,
      nodeList(
        name.lineno,
        name.colno,
        [node, ...parseFilterCallArgs(ctx, node)]
      ).children
    );
  }

  return node;
};
