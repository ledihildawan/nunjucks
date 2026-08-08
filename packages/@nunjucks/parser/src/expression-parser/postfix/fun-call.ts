import { funCall } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TOKEN_LEFT_PAREN } from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import type { ParserContext } from "../../cursor.ts";
import { parseSignature } from "../../node-parser/signature.ts";
import { loc } from '@nunjucks/shared';

type LeftParenToken = Token & { type: typeof TOKEN_LEFT_PAREN };

export const parseFunCall = (parserContext: ParserContext, tok: LeftParenToken, target: Node): Node => {
  const signature = parseSignature(parserContext);
  return funCall(loc(tok), target, signature?.children ?? []);
};
