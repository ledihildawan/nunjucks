import {
  TOKEN_STRING,
  TOKEN_INT,
  TOKEN_FLOAT,
  TOKEN_BOOLEAN,
  TOKEN_NONE,
  TOKEN_REGEX,
  TOKEN_SYMBOL,
} from '../../lexer/token-types.js';
import { Literal, AstSymbol } from '../../nodes/index.js';
import { nextToken, pushToken, fail } from '../cursor.js';

export const parsePrimary = (ctx, noPostfix) => {
  const tok = nextToken(ctx);
  let val;
  let node = null;

  if (!tok) {
    fail(ctx, 'expected expression, got end of file');
  } else if (tok.type === TOKEN_STRING) {
    val = tok.value;
  } else if (tok.type === TOKEN_INT) {
    val = Number(tok.value);
  } else if (tok.type === TOKEN_FLOAT) {
    val = parseFloat(tok.value);
  } else if (tok.type === TOKEN_BOOLEAN) {
    if (tok.value === 'true') {
      val = true;
    } else if (tok.value === 'false') {
      val = false;
    } else {
      fail(ctx, 'invalid boolean: ' + tok.value,
        tok.lineno,
        tok.colno);
    }
  } else if (tok.type === TOKEN_NONE) {
    val = null;
  } else if (tok.type === TOKEN_REGEX) {
    val = new RegExp(tok.value.body, tok.value.flags);
  }

  if (val !== undefined) {
    node = Literal(tok.lineno, tok.colno, val);
  } else if (tok.type === TOKEN_SYMBOL) {
    node = AstSymbol(tok.lineno, tok.colno, tok.value);
  } else {
    pushToken(ctx, tok);
    node = ctx.parseAggregate();
  }

  if (!noPostfix) {
    node = ctx.parsePostfix(node);
  }

  if (node) {
    return node;
  }

  return fail(ctx, `unexpected token: ${tok.value}`, tok.lineno, tok.colno);
};
