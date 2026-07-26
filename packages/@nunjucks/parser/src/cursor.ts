import {
  TOKEN_BLOCK_END,
  TOKEN_SYMBOL,
  TOKEN_OPERATOR,
  TOKEN_VARIABLE_END,
  TOKEN_WHITESPACE,
} from '@nunjucks/lexer';
import type { Token, Delimiters } from '@nunjucks/lexer';
import type { Node } from '@nunjucks/nodes';
import { fail, } from "./error.ts";
import { createLog } from '@nunjucks/log';
import { ERROR_DEFINITIONS } from '@nunjucks/log';

export interface TokenStream {
  nextToken: () => Token | null;
  tags: Delimiters;
  trimBlocks?: boolean;
  lstripBlocks?: boolean;
  lineno?: number;
  colno?: number;
}

export interface ParserExtension {
  tags?: string[];
  parse?: (ctx: ParserContext, nodes: unknown, lexer: unknown) => Node | null;
  [key: string]: unknown;
}

export interface ParserContext {
  tokens: TokenStream;
  peeked: Token | null;
  breakOnBlocks: readonly string[] | null;
  dropLeadingWhitespace: boolean;
  extensions: ParserExtension[];
  securityConfig: Record<string, unknown>;
  TOKEN_SYMBOL?: string;
}

export type MutableNode = Node & {
  children: Node[];
};

export const createCursor = (tokens: TokenStream) => ({
  tokens,
  peeked: null,
  breakOnBlocks: null,
  dropLeadingWhitespace: false,
  extensions: []
});

export const nextToken = (ctx: ParserContext, withWhitespace?: boolean): Token => {
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
    while (tok && tok.type === TOKEN_WHITESPACE) {
      tok = ctx.tokens.nextToken();
    }
  }

  return tok as Token;
};

export const peekToken = (ctx: ParserContext): Token => {
  ctx.peeked = ctx.peeked || nextToken(ctx);
  return ctx.peeked as Token;
};

export const pushToken = (ctx: ParserContext, tok: Token | null): void => {
  if (ctx.peeked) {
    throw createLog('error', ERROR_DEFINITIONS.PARSER_PUSH_TOKEN, {}, null, { phase: 'parse', lineBase: 'zero' });
  }
  ctx.peeked = tok;
};

export const skip = (ctx: ParserContext, type: Token['type']): boolean => {
  const tok = nextToken(ctx);
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
  const tok = nextToken(ctx);
  if (!tok || tok.type !== type || tok.value !== val) {
    pushToken(ctx, tok);
    return false;
  }
  return true;
};

export const skipSymbol = (ctx: ParserContext, val: string): boolean => skipValue(ctx, TOKEN_SYMBOL, val);

export const skipOperator = (ctx: ParserContext, ...vals: string[]): boolean => {
  for (const val of vals) {
    if (skipValue(ctx, TOKEN_OPERATOR, val)) {
      return true;
    }
  }
  return false;
};

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

  if (tok && tok.type === TOKEN_BLOCK_END) {
    if ((tok.value as string).charAt(0) === '-') {
      ctx.dropLeadingWhitespace = true;
    }
  } else {
    fail(ctx, `expected block end in ${blockName} statement`);
  }

  return tok;
};

export const advanceAfterVariableEnd = (ctx: ParserContext): void => {
  const tok = nextToken(ctx);

  if (tok && tok.type === TOKEN_VARIABLE_END) {
    ctx.dropLeadingWhitespace = (tok.value as string).charAt(
      (tok.value as string).length - ctx.tokens.tags.VARIABLE_END.length - 1
    ) === '-';
  } else {
    pushToken(ctx, tok);
    fail(ctx, 'expected variable end');
  }
};

export { error, fail, EXPECTED_COLON_AFTER_DICT_KEY } from './error.ts';
