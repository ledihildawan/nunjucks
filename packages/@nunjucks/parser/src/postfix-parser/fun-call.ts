import { funCall } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { Token } from '@nunjucks/lexer';
import type { ParserContext } from "../cursor.ts";
import { parseSignature } from "../node-parsers/signature.ts";

export const parseFunCall = (ctx: ParserContext, tok: Token, target: Node): Node => {
  const signature = parseSignature(ctx);
  return funCall(tok.lineno, tok.colno, target, signature?.children ?? []);
};
