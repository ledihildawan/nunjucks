import type { TemplateError } from '@nunjucks/error-formatter';
import type { LexerOptions } from '@nunjucks/lexer';
import { createTokenizer } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { root } from '@nunjucks/nodes';
import { ZERO_LOC } from '@nunjucks/shared';
import type { ExpressionSecurityConfig } from '@nunjucks/validators';
import { validateExpression } from '@nunjucks/validators';
import type { ParserContext, ParserExtension, TokenStream } from './cursor.ts';
import { fail } from './cursor.ts';
import { parseNodes } from './parse-root.ts';

export interface ParseOptions extends LexerOptions {
  security?: ExpressionSecurityConfig | null;
  autoescape?: boolean;
  extensions?: readonly ParserExtension[];
}

export const createParser = (tokens: TokenStream): ParserContext => {
  return {
    tokens,
    peeked: null,
    dropLeadingWhitespace: false,
    extensions: [],
  };
};

export const parse = (
  src: string,
  options?: ParseOptions
): Result<Node & { children: readonly Node[] }, TemplateError> => {
  const securityConfig = options?.security ?? null;
  const parser = createParser(createTokenizer(src, options));
  const { extensions } = options ?? {};
  if (extensions !== undefined) {
    parser.extensions = [...extensions];
  }
  const nodesR = parseNodes(parser);
  if (isErr(nodesR)) {
    return nodesR;
  }
  const ast = root(ZERO_LOC, nodesR.value);

  if (securityConfig !== null) {
    const validation = validateExpression(ast, securityConfig);
    if (isErr(validation)) {
      const [firstError] = validation.error;
      return fail(parser, firstError.message, {
        lineno: firstError.lineno,
        colno: firstError.colno,
      });
    }
  }

  return ok(ast);
};
