import {
  TOKEN_BLOCK_END,
  TOKEN_SYMBOL,
  TOKEN_OPERATOR,
  TOKEN_VARIABLE_END,
  TOKEN_WHITESPACE,
} from '../lexer/token-types.js';
import { error, fail } from './error.js';

export const createCursor = (tokens) => ({
  tokens,
  peeked: null,
  breakOnBlocks: null,
  dropLeadingWhitespace: false,
  extensions: []
});

export const nextToken = (ctx, withWhitespace) => {
  let tok;

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

  return tok;
};

export const peekToken = (ctx) => {
  ctx.peeked = ctx.peeked || nextToken(ctx);
  return ctx.peeked;
};

export const pushToken = (ctx, tok) => {
  if (ctx.peeked) {
    throw new Error('pushToken: can only push one token on between reads');
  }
  ctx.peeked = tok;
};

export const skip = (ctx, type) => {
  let tok = nextToken(ctx);
  if (!tok || tok.type !== type) {
    pushToken(ctx, tok);
    return false;
  }
  return true;
};

export const expect = (ctx, type) => {
  let tok = nextToken(ctx);
  if (tok.type !== type) {
    fail(ctx, 'expected ' + type + ', got ' + tok.type, tok.lineno, tok.colno);
  }
  return tok;
};

export const skipValue = (ctx, type, val) => {
  let tok = nextToken(ctx);
  if (!tok || tok.type !== type || tok.value !== val) {
    pushToken(ctx, tok);
    return false;
  }
  return true;
};

export const skipSymbol = (ctx, val) => skipValue(ctx, TOKEN_SYMBOL, val);

export const skipOperator = (ctx, ...vals) => {
  for (const val of vals) {
    if (skipValue(ctx, TOKEN_OPERATOR, val)) {
      return true;
    }
  }
  return false;
};

export const advanceAfterBlockEnd = (ctx, name) => {
  let tok;
  if (!name) {
    tok = peekToken(ctx);

    if (!tok) {
      fail(ctx, 'unexpected end of file');
    }

    if (tok.type !== TOKEN_SYMBOL) {
      fail(ctx, 'advanceAfterBlockEnd: expected symbol token or ' +
        'explicit name to be passed');
    }

    name = nextToken(ctx).value;
  }

  tok = nextToken(ctx);

  if (tok && tok.type === TOKEN_BLOCK_END) {
    if (tok.value.charAt(0) === '-') {
      ctx.dropLeadingWhitespace = true;
    }
  } else {
    fail(ctx, 'expected block end in ' + name + ' statement');
  }

  return tok;
};

export const advanceAfterVariableEnd = (ctx) => {
  let tok = nextToken(ctx);

  if (tok && tok.type === TOKEN_VARIABLE_END) {
    ctx.dropLeadingWhitespace = tok.value.charAt(
      tok.value.length - ctx.tokens.tags.VARIABLE_END.length - 1
    ) === '-';
  } else {
    pushToken(ctx, tok);
    fail(ctx, 'expected variable end');
  }
};

export { error, fail };
