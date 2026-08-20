import type { TemplateError } from '@nunjucks/error-formatter';
import { isTemplateError } from '@nunjucks/error-formatter';
import type { LexerOptions } from '@nunjucks/lexer';
import { createTokenizer } from '@nunjucks/lexer';
import { err, isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { root } from '@nunjucks/nodes';
import { ZERO_LOC } from '@nunjucks/shared';
import type { ExpressionSecurityConfig } from '@nunjucks/validators';
import { validateExpression } from '@nunjucks/validators';
import { fail } from './error.ts';
import { parseExpression, parsePrimary } from './expression-parser/index.ts';
import { parseNodes, parseUntilBlocks } from './parse-root.ts';
import type { ParserContext, ParserExtension, TokenStream } from './parser-context.ts';

/**
 * Parser entry options: lexer delimiters plus optional expression-security
 * config, autoescape, and parser extensions.
 */
export interface ParseOptions extends LexerOptions {
  security?: ExpressionSecurityConfig | null;
  autoescape?: boolean;
  extensions?: readonly ParserExtension[];
}

/** Creates a fresh `ParserContext` over a token stream with no peeked token. */
export const createParser = (tokens: TokenStream): ParserContext => {
  // WHY: the parse* members are the late-bound recursion seam assigned once here —
  // recursive-descent tiers (statement ↔ node loop ↔ expression) call each other
  // through the context so the module graph stays acyclic (see parser-context.ts).
  const parserContext: ParserContext = {
    tokens,
    peeked: null,
    dropLeadingWhitespace: false,
    extensions: [],
    parseNodes: (breakOn) => parseNodes(parserContext, breakOn),
    parseUntilBlocks: (...blockNames) => parseUntilBlocks(parserContext, ...blockNames),
    parseExpression: () => parseExpression(parserContext),
    parsePrimary: () => parsePrimary(parserContext),
  };
  return parserContext;
};

/**
 * Parses template source into a root AST node, returning `Err` with a
 * catalogued parser error for syntax failures instead of throwing;
 * non-template throws are programmer bugs and deliberately propagate.
 * When `security` is set, the finished AST is validated before returning.
 */
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
  let nodesR: Result<Node[], TemplateError>;
  try {
    nodesR = parseNodes(parser);
  } catch (thrownError: unknown) {
    // WHY: the lexer tokenizer signals failures by throwing branded TemplateErrors while
    // parse() owns the Result boundary — template errors must never escape as exceptions.
    // Non-template throws are programmer/extension bugs and deliberately propagate.
    if (isTemplateError(thrownError)) {
      return err(thrownError);
    }
    throw thrownError;
  }
  if (isErr(nodesR)) {
    return nodesR;
  }
  const ast = root(ZERO_LOC, nodesR.value);

  if (securityConfig !== null) {
    const validation = validateExpression(ast, securityConfig);
    if (isErr(validation)) {
      const [firstError] = validation.error;
      return fail(parser, {
        message: firstError.message,
        lineno: firstError.lineno,
        colno: firstError.colno,
      });
    }
  }

  return ok(ast);
};
