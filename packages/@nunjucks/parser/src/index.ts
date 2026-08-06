import { createTokenizer } from '@nunjucks/lexer';
import type { LexerOptions } from '@nunjucks/lexer';
import { root } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
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

export const parse = (src: string, extensions?: ParserExtension[], opts?: ParseOptions): Node & { children: readonly Node[] } => {
  const securityConfig = opts?.security ?? null;
  const p = createParser(createTokenizer(src, opts));
  if (extensions !== undefined) {
    p.extensions = extensions;
  }
  const ast = root(0, 0, parseNodes(p));

  if (securityConfig !== null) {
    const [firstError] = validateExpression(ast, securityConfig);
    if (firstError) {
      fail(p, firstError.message, firstError.lineno, firstError.colno);
    }
  }

  return ast;
};
