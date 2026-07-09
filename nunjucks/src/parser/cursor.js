import * as lexer from '../lexer/index.js';
import { TemplateError } from '../error/index.js';

export const createCursor = (tokens) => ({
  tokens,
  peeked: null,
  breakOnBlocks: null,
  dropLeadingWhitespace: false,
  extensions: []
});

export const nextToken = (ctx, withWhitespace) => {
  var tok;

  if (ctx.peeked) {
    if (!withWhitespace && ctx.peeked.type === lexer.TOKEN_WHITESPACE) {
      ctx.peeked = null;
    } else {
      tok = ctx.peeked;
      ctx.peeked = null;
      return tok;
    }
  }

  tok = ctx.tokens.nextToken();

  if (!withWhitespace) {
    while (tok && tok.type === lexer.TOKEN_WHITESPACE) {
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
  var tok = nextToken(ctx);
  if (!tok || tok.type !== type) {
    pushToken(ctx, tok);
    return false;
  }
  return true;
};

export const expect = (ctx, type) => {
  var tok = nextToken(ctx);
  if (tok.type !== type) {
    fail(ctx, 'expected ' + type + ', got ' + tok.type, tok.lineno, tok.colno);
  }
  return tok;
};

export const skipValue = (ctx, type, val) => {
  var tok = nextToken(ctx);
  if (!tok || tok.type !== type || tok.value !== val) {
    pushToken(ctx, tok);
    return false;
  }
  return true;
};

export const skipSymbol = (ctx, val) => skipValue(ctx, lexer.TOKEN_SYMBOL, val);

export const advanceAfterBlockEnd = (ctx, name) => {
  var tok;
  if (!name) {
    tok = peekToken(ctx);

    if (!tok) {
      fail(ctx, 'unexpected end of file');
    }

    if (tok.type !== lexer.TOKEN_SYMBOL) {
      fail(ctx, 'advanceAfterBlockEnd: expected symbol token or ' +
        'explicit name to be passed');
    }

    name = nextToken(ctx).value;
  }

  tok = nextToken(ctx);

  if (tok && tok.type === lexer.TOKEN_BLOCK_END) {
    if (tok.value.charAt(0) === '-') {
      ctx.dropLeadingWhitespace = true;
    }
  } else {
    fail(ctx, 'expected block end in ' + name + ' statement');
  }

  return tok;
};

export const advanceAfterVariableEnd = (ctx) => {
  var tok = nextToken(ctx);

  if (tok && tok.type === lexer.TOKEN_VARIABLE_END) {
    ctx.dropLeadingWhitespace = tok.value.charAt(
      tok.value.length - ctx.tokens.tags.VARIABLE_END.length - 1
    ) === '-';
  } else {
    pushToken(tok);
    fail(ctx, 'expected variable end');
  }
};

export const error = (ctx, msg, lineno, colno) => {
  if (lineno === undefined || colno === undefined) {
    const tok = peekToken(ctx) || {};
    lineno = tok.lineno;
    colno = tok.colno;
  }
  return new TemplateError(msg, lineno, colno, { phase: 'parse' });
};

export const fail = (ctx, msg, lineno, colno) => {
  throw error(ctx, msg, lineno, colno);
};
