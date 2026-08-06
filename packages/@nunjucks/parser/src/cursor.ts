import {
  TOKEN_SYMBOL,
  TOKEN_OPERATOR,
  TOKEN_WHITESPACE,
  isBlockEndToken,
  isVariableEndToken,
} from '@nunjucks/lexer';
import type { Token, Delimiters } from '@nunjucks/lexer';
import type { Node } from '@nunjucks/nodes';
import { fail } from "./error.ts";
import { createLog } from '@nunjucks/log';
import { ERROR_DEFINITIONS } from '@nunjucks/log';

export interface TokenStream {
  nextToken: () => Token | null;
  tags: Delimiters;
}

export interface ParserExtension {
  tags?: string[];
  parse?: (ctx: ParserContext, nodes: unknown, lexer: unknown) => Node | null;
  [key: string]: unknown;
}

export interface ParserContext {
  tokens: TokenStream;
  peeked: Token | null;
  dropLeadingWhitespace: boolean;
  extensions: ParserExtension[];
}

/**
 * Internal: advance the cursor by one token, returning `null` at EOF.
 * Used by helpers that legitimately treat EOF as "no match" (e.g. `skip`)
 * and by the main parse loop to detect end-of-stream.
 */
export const nextTokenOrNull = (ctx: ParserContext, withWhitespace?: boolean): Token | null => {
  let tok: Token | null;

  if (ctx.peeked) {
    if (!withWhitespace && ctx.peeked.type === TOKEN_WHITESPACE) {
      ctx.peeked = null;
    } else {
      tok = ctx.peeked;
      ctx.peeked = null;
      return tok;
    }
  }

  tok = ctx.tokens.nextToken();

  if (!withWhitespace) {
    while (tok?.type === TOKEN_WHITESPACE) {
      tok = ctx.tokens.nextToken();
    }
  }

  return tok;
};

const EOF_LOCATION = { lineno: 0, colno: 0 } as const;

/**
 * Advance the cursor by one token. Throws a parse error if the stream is
 * exhausted (unexpected EOF is always a syntax error in a well-formed parse
 * loop, so callers receive a non-null `Token` and never need to null-check).
 * Use `nextTokenOrNull` for optional-consume helpers.
 */
export const nextToken = (ctx: ParserContext, withWhitespace?: boolean): Token => {
  const tok = nextTokenOrNull(ctx, withWhitespace);
  if (tok === null) {
    return fail(ctx, 'unexpected end of input', EOF_LOCATION.lineno, EOF_LOCATION.colno);
  }
  return tok;
};

export const peekToken = (ctx: ParserContext): Token => {
  if (ctx.peeked === null) {
    ctx.peeked = nextTokenOrNull(ctx);
  }
  if (ctx.peeked === null) {
    return fail(ctx, 'unexpected end of input', EOF_LOCATION.lineno, EOF_LOCATION.colno);
  }
  return ctx.peeked;
};

/** Like `peekToken` but returns `null` at EOF instead of throwing. For optional-lookahead call sites. */
export const peekTokenOrNull = (ctx: ParserContext): Token | null => {
  if (ctx.peeked === null) {
    ctx.peeked = nextTokenOrNull(ctx);
  }
  return ctx.peeked;
};

export const pushToken = (ctx: ParserContext, tok: Token | null): void => {
  if (ctx.peeked) {
    throw createLog('error', ERROR_DEFINITIONS.PARSER_PUSH_TOKEN, {}, null, { phase: 'parse', lineBase: 'zero' });
  }
  ctx.peeked = tok;
};

export const skip = (ctx: ParserContext, type: Token['type']): boolean => {
  const tok = nextTokenOrNull(ctx);
  if (!tok || tok.type !== type) {
    pushToken(ctx, tok);
    return false;
  }
  return true;
};

export const expect = (ctx: ParserContext, type: Token['type']): Token => {
  const tok = nextToken(ctx);
  if (tok.type !== type) {
    fail(ctx, `expected ${type}, got ${tok.type}`, tok.lineno, tok.colno);
  }
  return tok;
};

export const skipValue = (ctx: ParserContext, type: Token['type'], val?: Token['value']): boolean => {
  const tok = nextTokenOrNull(ctx);
  if (!tok || tok.type !== type || tok.value !== val) {
    pushToken(ctx, tok);
    return false;
  }
  return true;
};

export const skipSymbol = (ctx: ParserContext, val: string): boolean => skipValue(ctx, TOKEN_SYMBOL, val);

/** Read and auto-reset the leading-whitespace-drop flag. Each token handler
 *  should call this (or set it explicitly) — never read the flag directly. */
export const consumeWhitespaceDrop = (ctx: ParserContext): boolean => {
  const drop = ctx.dropLeadingWhitespace;
  ctx.dropLeadingWhitespace = false;
  return drop;
};

export const skipOperator = (ctx: ParserContext, ...vals: string[]): boolean =>
  vals.some(val => skipValue(ctx, TOKEN_OPERATOR, val));

export const advanceAfterBlockEnd = (ctx: ParserContext, name?: string): Token => {
  let tok: Token;
  let blockName = name;
  if (!blockName) {
    tok = peekToken(ctx);

    if (!tok) {
      fail(ctx, 'unexpected end of file');
    }

    if (tok.type !== TOKEN_SYMBOL) {
      fail(ctx, 'advanceAfterBlockEnd: expected symbol token or ' +
        'explicit name to be passed');
    }

    blockName = nextToken(ctx).value as string;
  }

  tok = nextToken(ctx);

  if (isBlockEndToken(tok)) {
    if (tok.value.charAt(0) === '-') {
      ctx.dropLeadingWhitespace = true;
    }
  } else {
    fail(ctx, `expected block end in ${blockName} statement`);
  }

  return tok;
};

export const advanceAfterVariableEnd = (ctx: ParserContext): void => {
  const tok = nextToken(ctx);

  if (isVariableEndToken(tok)) {
    ctx.dropLeadingWhitespace = tok.value.charAt(
      tok.value.length - ctx.tokens.tags.VARIABLE_END.length - 1
    ) === '-';
  } else {
    pushToken(ctx, tok);
    fail(ctx, 'expected variable end');
  }
};

export { fail } from './error.ts';
