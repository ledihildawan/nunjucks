import { funCall } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import type { TOKEN_LEFT_PAREN } from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import { ok, isErr, type Result } from '@nunjucks/lib';
import type { ParserContext } from "../../cursor.ts";
import { parseSignature } from "../../node-parser/signature.ts";
import { loc } from '@nunjucks/lexer';

type LeftParenToken = Token & { type: typeof TOKEN_LEFT_PAREN };

export const parseFunCall = (parserContext: ParserContext, tok: LeftParenToken, target: Node): Result<Node, TemplateError> => {
  const sigR = parseSignature({ parserContext });
  if (isErr(sigR)) { return sigR; }
  const sig = sigR.value;
  return ok(funCall(loc(tok), { name: target, args: sig?.children ?? [] }));
};
