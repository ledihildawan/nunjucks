import type { TemplateError } from '@nunjucks/error-formatter';
import type { TOKEN_LEFT_PAREN, Token } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { funCall } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../../cursor.ts';
import { parseSignature } from '../../node-parser/signature.ts';

type LeftParenToken = Token & { type: typeof TOKEN_LEFT_PAREN };

export const parseFunCall = (
  parserContext: ParserContext,
  tok: LeftParenToken,
  target: Node
): Result<Node, TemplateError> => {
  const sigR = parseSignature({ parserContext });
  if (isErr(sigR)) {
    return sigR;
  }
  const sig = sigR.value;
  return ok(funCall(loc(tok), { name: target, args: sig?.children ?? [] }));
};
