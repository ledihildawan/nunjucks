import { createTokenizer } from '@nunjucks/lexer';
import type { LexerOptions } from '@nunjucks/lexer';
import { root } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { fail } from "./cursor.ts";
import type { ParserContext, ParserExtension, TokenStream } from "./cursor.ts";
import { parseNodes } from "./top-level.ts";
import { validateExpression, DEFAULT_SECURITY_CONFIG } from './expression-validator.ts';

export interface ParseOptions extends LexerOptions {
  security?: Record<string, unknown> | null;
  autoescape?: boolean;
}

export function createParser(tokens: TokenStream, securityConfig: Record<string, unknown> = {}): ParserContext {
  return {
    tokens,
    peeked: null,
    breakOnBlocks: null,
    dropLeadingWhitespace: false,
    extensions: [],
    securityConfig: { ...DEFAULT_SECURITY_CONFIG, ...securityConfig },
  };
}

export function parse(src: string, extensions?: ParserExtension[], opts?: ParseOptions): Node & { children: Node[] } {
  const securityConfig = opts?.security ?? null;
  const p = createParser(createTokenizer(src, opts), securityConfig ?? {});
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

  return ast as Node & { children: Node[] };
}
