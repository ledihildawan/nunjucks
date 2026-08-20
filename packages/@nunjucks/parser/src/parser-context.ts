import type { TemplateError } from '@nunjucks/error-formatter';
import type { Delimiters, Token } from '@nunjucks/lexer';
import { TOKEN_WHITESPACE } from '@nunjucks/lexer';
import type { Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';

/**
 * Pull-based token source: `nextToken` yields the next token or `null` at
 * end of input, and `tags` exposes the active delimiter strings.
 */
export interface TokenStream {
  nextToken: () => Token | null;
  tags: Delimiters;
}

/**
 * Custom tag hook: `tags` lists the tag names the extension owns, and `parse`
 * receives the parser context, node builders, and lexer token constants.
 */
export interface ParserExtension {
  tags?: string[];
  parse?: (parserContext: ParserContext, nodes: unknown, lexer: unknown) => Node | null;
  [key: string]: unknown;
}

/**
 * Mutable parser state threaded through every parse function: the token
 * stream, a single-slot peek/pushback buffer, the whitespace-drop flag, and
 * the registered extensions.
 *
 * The `parse*` members are the late-bound recursion seam: recursive-descent
 * grammar tiers (statement ↔ node loop ↔ expression) are mutually recursive
 * by nature, so wiring the recursion points through the context — assigned
 * once in `createParser` — keeps the module graph acyclic instead of encoding
 * the grammar recursion as import cycles.
 */
export interface ParserContext {
  tokens: TokenStream;
  peeked: Token | null;
  dropLeadingWhitespace: boolean;
  extensions: ParserExtension[];
  parseNodes: (breakOn?: readonly string[] | null) => Result<Node[], TemplateError>;
  parseUntilBlocks: (...blockNames: string[]) => Result<Node, TemplateError>;
  parseExpression: () => Result<Node, TemplateError>;
  parsePrimary: () => Result<Node, TemplateError>;
}

interface NextTokenOptions {
  withWhitespace?: boolean;
}

/**
 * Consumes and returns the next token, or `null` at end of input. Whitespace
 * tokens are skipped unless `withWhitespace` is set, and a peeked whitespace
 * token is discarded rather than returned.
 */
export const nextTokenOrNull = (
  parserContext: ParserContext,
  options?: NextTokenOptions
): Token | null => {
  const withWhitespace = options?.withWhitespace ?? false;
  let tok: Token | null;

  if (parserContext.peeked) {
    if (!withWhitespace && parserContext.peeked.type === TOKEN_WHITESPACE) {
      parserContext.peeked = null;
    } else {
      tok = parserContext.peeked;
      parserContext.peeked = null;
      return tok;
    }
  }

  tok = parserContext.tokens.nextToken();

  if (!withWhitespace) {
    // WHY: iterative loop (parser loop exemption) — the recursive skipper
    // overflowed the stack on pathological runs of merged whitespace tokens.
    while (tok?.type === TOKEN_WHITESPACE) {
      tok = parserContext.tokens.nextToken();
    }
  }

  return tok;
};
