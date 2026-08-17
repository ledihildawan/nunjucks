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

interface NextTokenOptions {
  withWhitespace?: boolean;
}

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

export const peekTokenOrNull = (parserContext: ParserContext): Token | null => {
  if (parserContext.peeked === null) {
    parserContext.peeked = nextTokenOrNull(parserContext);
  }
  return parserContext.peeked;
};

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

export const skip = (parserContext: ParserContext, type: Token['type']): boolean => {
  const tok = nextTokenOrNull(parserContext);
  if (!tok || tok.type !== type) {
    pushToken(parserContext, tok);
    return false;
  }
  return true;
};

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

export const skipSymbol = (parserContext: ParserContext, symbolName: string): boolean =>
  skipValue(parserContext, TOKEN_SYMBOL, symbolName);

export const consumeWhitespaceDrop = (parserContext: ParserContext): boolean => {
  const drop = parserContext.dropLeadingWhitespace;
  parserContext.dropLeadingWhitespace = false;
  return drop;
};

export const skipOperator = (parserContext: ParserContext, ...vals: string[]): boolean =>
  vals.some((value) => skipValue(parserContext, TOKEN_OPERATOR, value));

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
