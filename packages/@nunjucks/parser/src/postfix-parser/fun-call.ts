import { funCall } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Token } from '@nunjucks/lexer';
import type { ParserContext } from "../cursor.ts";
import { parseSignature } from "../node-parsers/index.ts";

export const parseFunCall = (ctx: ParserContext, tok: Token, target: Node): Node => {
  return funCall(tok.lineno, tok.colno, target, parseSignature(ctx) as unknown as Node[]);
};
