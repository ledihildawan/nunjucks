import { createTokenizer } from '@nunjucks/lexer';
import type { LexerOptions } from '@nunjucks/lexer';
import { root } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { ZERO_LOC } from '@nunjucks/shared';
import { ok, isErr, type Result } from '@nunjucks/lib';
import { fail } from "./cursor.ts";
import type { ParserContext, ParserExtension, TokenStream } from "./cursor.ts";
import { parseNodes } from "./parse-root.ts";
import { validateExpression } from '@nunjucks/validators';
import type { ExpressionSecurityConfig } from '@nunjucks/validators';

export interface ParseOptions extends LexerOptions {
  security?: ExpressionSecurityConfig | null;
  autoescape?: boolean;
}

export const createParser = (tokens: TokenStream): ParserContext => {
  return {
    tokens,
    peeked: null,
    dropLeadingWhitespace: false,
    extensions: [],
  };
};

export const parse = (src: string, extensions?: ParserExtension[], options?: ParseOptions): Result<Node & { children: readonly Node[] }, TemplateError> => {
  const securityConfig = options?.security ?? null;
  const parser = createParser(createTokenizer(src, options));
  if (extensions !== undefined) {
    parser.extensions = extensions;
  }
  const nodesR = parseNodes(parser);
  if (isErr(nodesR)) { return nodesR; }
  const ast = root(ZERO_LOC, nodesR.value);

  if (securityConfig !== null) {
    const validation = validateExpression(ast, securityConfig);
    if (isErr(validation)) {
      const [firstError] = validation.error;
      return fail(parser, firstError.message, { lineno: firstError.lineno, colno: firstError.colno });
    }
  }

  return ok(ast);
};
