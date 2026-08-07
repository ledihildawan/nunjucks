import {
  TOKEN_SYMBOL,
  TOKEN_OPERATOR,
  TOKEN_WHITESPACE,
  isBlockEndToken,
  isVariableEndToken,
  isSymbolToken,
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
  parse?: (parserContext: ParserContext, nodes: unknown, lexer: unknown) => Node | null;
  [key: string]: unknown;
}

export interface ParserContext {
  tokens: TokenStream;
  peeked: Token | null;
  dropLeadingWhitespace: boolean;
  extensions: ParserExtension[];
}

export const nextTokenOrNull = (parserContext: ParserContext, withWhitespace?: boolean): Token | null => {
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
    while (tok?.type === TOKEN_WHITESPACE) {
      tok = parserContext.tokens.nextToken();
    }
  }

  return tok;
};

const EOF_LOCATION = { lineno: 0, colno: 0 } as const;

export const nextToken = (parserContext: ParserContext, withWhitespace?: boolean): Token => {
  const tok = nextTokenOrNull(parserContext, withWhitespace);
  if (tok === null) {
    return fail(parserContext, 'unexpected end of input', EOF_LOCATION.lineno, EOF_LOCATION.colno);
  }
  return tok;
};

export const peekToken = (parserContext: ParserContext): Token => {
  if (parserContext.peeked === null) {
    parserContext.peeked = nextTokenOrNull(parserContext);
  }
  if (parserContext.peeked === null) {
    return fail(parserContext, 'unexpected end of input', EOF_LOCATION.lineno, EOF_LOCATION.colno);
  }
  return parserContext.peeked;
};

export const peekTokenOrNull = (parserContext: ParserContext): Token | null => {
  if (parserContext.peeked === null) {
    parserContext.peeked = nextTokenOrNull(parserContext);
  }
  return parserContext.peeked;
};

export const pushToken = (parserContext: ParserContext, tok: Token | null): void => {
  if (parserContext.peeked) {
    throw createLog('error', ERROR_DEFINITIONS.PARSER_PUSH_TOKEN, {}, null, { phase: 'parse', lineBase: 'zero' });
  }
  parserContext.peeked = tok;
};

export const skip = (parserContext: ParserContext, type: Token['type']): boolean => {
  const tok = nextTokenOrNull(parserContext);
  if (!tok || tok.type !== type) {
    pushToken(parserContext, tok);
    return false;
  }
  return true;
};

export const expect = (parserContext: ParserContext, type: Token['type']): Token => {
  const tok = nextToken(parserContext);
  if (tok.type !== type) {
    fail(parserContext, `expected ${type}, got ${tok.type}`, tok.lineno, tok.colno);
  }
  return tok;
};

export const skipValue = (parserContext: ParserContext, type: Token['type'], value?: Token['value']): boolean => {
  const tok = nextTokenOrNull(parserContext);
  if (!tok || tok.type !== type || tok.value !== value) {
    pushToken(parserContext, tok);
    return false;
  }
  return true;
};

export const skipSymbol = (parserContext: ParserContext, value: string): boolean => skipValue(parserContext, TOKEN_SYMBOL, value);

export const consumeWhitespaceDrop = (parserContext: ParserContext): boolean => {
  const drop = parserContext.dropLeadingWhitespace;
  parserContext.dropLeadingWhitespace = false;
  return drop;
};

export const skipOperator = (parserContext: ParserContext, ...vals: string[]): boolean =>
  vals.some(value => skipValue(parserContext, TOKEN_OPERATOR, value));

export const advanceAfterBlockEnd = (parserContext: ParserContext, name?: string): Token => {
  let tok: Token;
  let blockName = name;
  if (!blockName) {
    const nameTok = nextToken(parserContext);

    blockName = isSymbolToken(nameTok)
      ? nameTok.value
      : fail(parserContext, 'advanceAfterBlockEnd: expected symbol token or ' +
          'explicit name to be passed', nameTok.lineno, nameTok.colno);
  }

  tok = nextToken(parserContext);

  if (isBlockEndToken(tok)) {
    if (tok.value.charAt(0) === '-') {
      parserContext.dropLeadingWhitespace = true;
    }
  } else {
    fail(parserContext, `expected block end in ${blockName} statement`);
  }

  return tok;
};

export const advanceAfterVariableEnd = (parserContext: ParserContext): void => {
  const tok = nextToken(parserContext);

  if (isVariableEndToken(tok)) {
    parserContext.dropLeadingWhitespace = tok.value.charAt(
      tok.value.length - parserContext.tokens.tags.variableEnd.length - 1
    ) === '-';
  } else {
    pushToken(parserContext, tok);
    fail(parserContext, 'expected variable end');
  }
};

export { fail } from './error.ts';
