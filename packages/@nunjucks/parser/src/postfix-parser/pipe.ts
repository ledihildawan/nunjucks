import {
  TOKEN_OPERATOR,
  TOKEN_PIPEFORWARD,
  TOKEN_LEFT_PAREN,
  TOKEN_SYMBOL,
} from '@nunjucks/lexer';
import { nodes } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skip, skipValue, expect } from "../cursor.ts";
import type { ParserContext, MutableNode } from "../cursor.ts";
import { parsePostfix } from "./index.ts";

export const parseFilterName = (ctx: ParserContext): Node => {
  const tok = expect(ctx, TOKEN_SYMBOL);
  let name = tok.value as string;

  while (skipValue(ctx, TOKEN_OPERATOR, '.')) {
    name += '.' + (expect(ctx, TOKEN_SYMBOL).value as string);
  }

  return nodes.symbol(tok.lineno, tok.colno, name);
};

export const parseFilterArgs = (ctx: ParserContext, node: Node): Node[] => {
  if (peekToken(ctx).type === TOKEN_LEFT_PAREN) {
    const call = parsePostfix(ctx, node);
    return (call as Node & { args: MutableNode }).args.children;
  }
  return [];
};

export const parsePipe = (ctx: ParserContext, node: Node): Node => {
  while (skip(ctx, TOKEN_PIPEFORWARD)) {
    const name = parseFilterName(ctx);

    node = nodes.pipe(
      name.lineno,
      name.colno,
      name,
      nodes.nodeList(
        name.lineno,
        name.colno,
        [node].concat(parseFilterArgs(ctx, node))
      ) as unknown as Node[]
    );
  }

  return node;
};
