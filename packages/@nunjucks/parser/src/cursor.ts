import type { TemplateError } from '@nunjucks/error-formatter';
import type { Delimiters, Token } from '@nunjucks/lexer';
import {
  isBlockEndToken,
  isSymbolToken,
  isVariableEndToken,
  TOKEN_OPERATOR,
  TOKEN_SYMBOL,
  TOKEN_WHITESPACE,
} from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { fail } from './error.ts';

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
 */
export interface ParserContext {
  tokens: TokenStream;
  peeked: Token | null;
  dropLeadingWhitespace: boolean;
  extensions: ParserExtension[];
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
    const skipWhitespace = (currentTok: Token | null): Token | null => {
      if (currentTok?.type !== TOKEN_WHITESPACE) {
        return currentTok;
      }
      return skipWhitespace(parserContext.tokens.nextToken());
    };
    tok = skipWhitespace(tok);
  }

  return tok;
};

const EOF_LOCATION = { lineno: 0, colno: 0 } as const;

/**
 * Consumes the next token, failing with an `unexpected end of input` error
 * at line 0, column 0 once the stream is exhausted.
 */
export const nextToken = (
  parserContext: ParserContext,
  options?: NextTokenOptions
): Result<Token, TemplateError> => {
  const tok = nextTokenOrNull(parserContext, options);
  if (tok === null) {
    return fail(parserContext, {
      message: 'unexpected end of input',
      lineno: EOF_LOCATION.lineno,
      colno: EOF_LOCATION.colno,
    });
  }
  return ok(tok);
};

/**
 * Peeks the next non-whitespace token without consuming it, caching it in
 * the one-slot peek buffer; fails at end of input.
 */
export const peekToken = (parserContext: ParserContext): Result<Token, TemplateError> => {
  if (parserContext.peeked === null) {
    parserContext.peeked = nextTokenOrNull(parserContext);
  }
  if (parserContext.peeked === null) {
    return fail(parserContext, {
      message: 'unexpected end of input',
      lineno: EOF_LOCATION.lineno,
      colno: EOF_LOCATION.colno,
    });
  }
  return ok(parserContext.peeked);
};

/** Peeks the next non-whitespace token without consuming it; `null` at end of input. */
export const peekTokenOrNull = (parserContext: ParserContext): Token | null => {
  if (parserContext.peeked === null) {
    parserContext.peeked = nextTokenOrNull(parserContext);
  }
  return parserContext.peeked;
};

/** Pushes a token back as the next read; a double push throws as a parser bug. */
export const pushToken = (parserContext: ParserContext, tok: Token | null): void => {
  if (parserContext.peeked) {
    // WHY: pushing over an already-peeked token is an invariant violation inside the
    // parser itself — a programmer bug, not a template error. It deliberately throws
    // UNBRANDED so parse()'s boundary contract propagates it as a bug instead of mapping
    // it to a user-facing Result error.
    throw new Error('parser bug: pushToken called while another token is already pushed');
  }
  parserContext.peeked = tok;
};

/** Consumes the next token if it matches `type`, pushing it back otherwise. */
export const skip = (parserContext: ParserContext, type: Token['type']): boolean => {
  const tok = nextTokenOrNull(parserContext);
  if (!tok || tok.type !== type) {
    pushToken(parserContext, tok);
    return false;
  }
  return true;
};

/**
 * Consumes the next token and fails with a catalogued error when its type
 * differs from `type`.
 */
export const expect = (
  parserContext: ParserContext,
  type: Token['type']
): Result<Token, TemplateError> => {
  const tokResult = nextToken(parserContext);
  if (isErr(tokResult)) {
    return tokResult;
  }
  const tok = tokResult.value;
  if (tok.type !== type) {
    return fail(parserContext, {
      message: `expected ${type}, got ${tok.type}`,
      lineno: tok.lineno,
      colno: tok.colno,
    });
  }
  return ok(tok);
};

/** Consumes the next token if it matches both `type` and `value`, pushing it back otherwise. */
export const skipValue = (
  parserContext: ParserContext,
  type: Token['type'],
  value?: Token['value']
): boolean => {
  const tok = nextTokenOrNull(parserContext);
  if (!tok || tok.type !== type || tok.value !== value) {
    pushToken(parserContext, tok);
    return false;
  }
  return true;
};

/** Consumes the next token if it is the symbol `symbolName`, pushing it back otherwise. */
export const skipSymbol = (parserContext: ParserContext, symbolName: string): boolean =>
  skipValue(parserContext, TOKEN_SYMBOL, symbolName);

/**
 * Reads and clears the whitespace-drop flag armed by a trailing `-` on
 * closing delimiters (`-%}`, `-}}`); callers strip leading whitespace
 * exactly once per armed tag.
 */
export const consumeWhitespaceDrop = (parserContext: ParserContext): boolean => {
  const drop = parserContext.dropLeadingWhitespace;
  parserContext.dropLeadingWhitespace = false;
  return drop;
};

/** Consumes the next token if it is an operator matching any of `vals`. */
export const skipOperator = (parserContext: ParserContext, ...vals: string[]): boolean =>
  vals.some((value) => skipValue(parserContext, TOKEN_OPERATOR, value));

/**
 * Consumes the closing `%}` of the current tag, reading the tag name from
 * the stream when `name` is omitted; a `-%}` end arms the whitespace-drop
 * flag for the next data token.
 */
export const advanceAfterBlockEnd = (
  parserContext: ParserContext,
  name?: string
): Result<Token, TemplateError> => {
  let blockName = name;
  if (!blockName) {
    const nameTokResult = nextToken(parserContext);
    if (isErr(nameTokResult)) {
      return nameTokResult;
    }
    const nameTok = nameTokResult.value;

    if (!isSymbolToken(nameTok)) {
      return fail(parserContext, {
        message: 'advanceAfterBlockEnd: expected symbol token or explicit name to be passed',
        lineno: nameTok.lineno,
        colno: nameTok.colno,
      });
    }
    blockName = nameTok.value;
  }

  const tokResult = nextToken(parserContext);
  if (isErr(tokResult)) {
    return tokResult;
  }
  const tok = tokResult.value;

  if (isBlockEndToken(tok)) {
    if (tok.value[0] === '-') {
      parserContext.dropLeadingWhitespace = true;
    }
    return ok(tok);
  }
  return fail(parserContext, { message: `expected block end in ${blockName} statement` });
};

/**
 * Consumes the closing `}}` of a `{{ ... }}` output, arming the
 * whitespace-drop flag when it is written `-}}`; a non-matching token is
 * pushed back before failing.
 */
export const advanceAfterVariableEnd = (
  parserContext: ParserContext
): Result<void, TemplateError> => {
  const tokResult = nextToken(parserContext);
  if (isErr(tokResult)) {
    return tokResult;
  }
  const tok = tokResult.value;

  if (isVariableEndToken(tok)) {
    parserContext.dropLeadingWhitespace =
      tok.value.at(tok.value.length - parserContext.tokens.tags.variableEnd.length - 1) === '-';
    return ok(undefined);
  }
  pushToken(parserContext, tok);
  return fail(parserContext, { message: 'expected variable end' });
};

export { fail } from './error.ts';
