import { createInternalInvariantError } from '@nunjucks/error-catalog';
import type { TemplateError } from '@nunjucks/error-formatter';
import type { Token } from '@nunjucks/lexer';
import {
  isBlockEndToken,
  isSymbolToken,
  isVariableEndToken,
  TOKEN_OPERATOR,
  TOKEN_SYMBOL,
} from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import { fail } from './error.ts';
import type { ParserContext } from './parser-context.ts';
import { nextTokenOrNull } from './parser-context.ts';

export type { ParserContext, ParserExtension, TokenStream } from './parser-context.ts';
export { nextTokenOrNull } from './parser-context.ts';

interface NextTokenOptions {
  withWhitespace?: boolean;
}

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
    // parser itself — a programmer bug, not a template error. The internal-invariant
    // brand is deliberately not TEMPLATE_ERROR, so parse()'s boundary contract propagates
    // it as a bug instead of mapping it to a user-facing Result error.
    throw createInternalInvariantError('pushToken called while another token is already pushed');
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

/**
 * Advances the token stream when the next token is the given symbol, leaving
 * the stream untouched otherwise — used by statement parsers to consume expected
 * punctuation (e.g. `endfor`, `endblock`) without throwing on mismatch.
 *
 * @param parserContext - The parser state.
 * @param symbolName - The exact symbol string to skip.
 * @returns `true` if the symbol was consumed, `false` if the stream was not advanced.
 */
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
export const skipOperator = (parserContext: ParserContext, ...vals: string[]): boolean => {
  // WHY: explicit loop — .some() reads as a pure membership test, but each probe
  // advances or pushes back the token stream.
  for (const value of vals) {
    if (skipValue(parserContext, TOKEN_OPERATOR, value)) {
      return true;
    }
  }
  return false;
};

/**
 * Consumes the closing `%}` of the current tag, reading the tag name from
 * the stream when `name` is omitted; a `-%}` end arms the whitespace-drop
 * flag for the next data token.
 */
export const advanceAfterBlockEnd = (
  parserContext: ParserContext,
  name?: string
): Result<Token, TemplateError> => {
  let blockName: string | undefined = name;
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
    // WHY: canonical strip flag instead of sniffing `value[0]` — a custom blockEnd
    // that merely STARTS with '-' would false-positive the old check.
    if (tok.stripRight === true) {
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
    // WHY: canonical strip flag instead of index arithmetic — the old
    // `length - variableEnd.length - 1` math miscomputed for custom-length variableEnd
    // tags (a strip `-}}` always carries its dash at index 0 of the token value).
    parserContext.dropLeadingWhitespace = tok.stripRight === true;
    return ok(undefined);
  }
  pushToken(parserContext, tok);
  return fail(parserContext, { message: 'expected variable end' });
};

export { fail } from './error.ts';
