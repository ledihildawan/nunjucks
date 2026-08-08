import { createTokenizer } from '@nunjucks/lexer';
import type { LexerOptions } from '@nunjucks/lexer';
import { root } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { ZERO_LOC } from '@nunjucks/shared';
import { fail } from "./cursor.ts";
import type { ParserContext, ParserExtension, TokenStream } from "./cursor.ts";
import { parseNodes } from "./parse-root.ts";
import { validateExpression } from '@nunjucks/validators';
import type { ExpressionSecurityConfig } from '@nunjucks/validators';

export { EXPECTED_COLON_AFTER_DICT_KEY } from "./error.ts";

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

export const parse = (src: string, extensions?: ParserExtension[], options?: ParseOptions): Node & { children: readonly Node[] } => {
  const securityConfig = options?.security ?? null;
  const parser = createParser(createTokenizer(src, options));
  if (extensions !== undefined) {
    parser.extensions = extensions;
  }
  const ast = root(ZERO_LOC, parseNodes(parser));

  if (securityConfig !== null) {
    const validation = validateExpression(ast, securityConfig);
    if (!validation.valid) {
      const firstError = validation.errors[0];
      fail(parser, firstError.message, firstError.lineno, firstError.colno);
    }
  }

  return ast;
};