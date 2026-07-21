import { lex } from '@nunjucks/lexer';
import type { LexerOptions } from '@nunjucks/lexer';
import {
  nodes,
} from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { fail } from "./cursor.ts";
import type { ParserContext, ParserExtension, TokenStream } from "./cursor.ts";
import { parseNodes } from "./top-level.ts";
import { validateExpression, DEFAULT_SECURITY_CONFIG } from './expression-validator.ts';

interface ParseOptions extends LexerOptions {
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
  const p = createParser(lex(src, opts), securityConfig ?? {});
  if (extensions !== undefined) {
    p.extensions = extensions;
  }
  const ast = nodes.root(0, 0, parseNodes(p));

  if (securityConfig !== null) {
    const errors = validateExpression(ast, securityConfig);
    if (errors.length > 0) {
      const firstError = errors[0]!;
      fail(p, firstError.message, firstError.lineno, firstError.colno);
    }
  }

  return ast as Node & { children: Node[] };
}
