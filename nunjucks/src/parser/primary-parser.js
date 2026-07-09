import * as lexer from '../lexer/index.js';
import {
  Literal,
  Symbol as ASTSymbol,
  Pipe,
  NodeList,
} from '../nodes.js';
import { nextToken, peekToken, pushToken, skip, skipValue, expect, fail } from './cursor.js';

export const parsePrimary = (ctx, noPostfix) => {
  const tok = nextToken(ctx);
  let val;
  let node = null;

  if (!tok) {
    fail(ctx, 'expected expression, got end of file');
  } else if (tok.type === lexer.TOKEN_STRING) {
    val = tok.value;
  } else if (tok.type === lexer.TOKEN_INT) {
    val = parseInt(tok.value, 10);
  } else if (tok.type === lexer.TOKEN_FLOAT) {
    val = parseFloat(tok.value);
  } else if (tok.type === lexer.TOKEN_BOOLEAN) {
    if (tok.value === 'true') {
      val = true;
    } else if (tok.value === 'false') {
      val = false;
    } else {
      fail(ctx, 'invalid boolean: ' + tok.value,
        tok.lineno,
        tok.colno);
    }
  } else if (tok.type === lexer.TOKEN_NONE) {
    val = null;
  } else if (tok.type === lexer.TOKEN_REGEX) {
    val = new RegExp(tok.value.body, tok.value.flags);
  }

  if (val !== undefined) {
    node = new Literal(tok.lineno, tok.colno, val);
  } else if (tok.type === lexer.TOKEN_SYMBOL) {
    node = new ASTSymbol(tok.lineno, tok.colno, tok.value);
  } else {
    // See if it's an aggregate type, we need to push the
    // current delimiter token back on
    pushToken(ctx, tok);
    node = ctx.parseAggregate();
  }

  if (!noPostfix) {
    node = ctx.parsePostfix(node);
  }

  if (node) {
    return node;
  } else {
    fail(ctx, `unexpected token: ${tok.value}`, tok.lineno, tok.colno);
  }
};

export const parseFilterName = (ctx) => {
  const tok = expect(ctx, lexer.TOKEN_SYMBOL);
  let name = tok.value;

  while (skipValue(ctx, lexer.TOKEN_OPERATOR, '.')) {
    name += '.' + expect(ctx, lexer.TOKEN_SYMBOL).value;
  }

  return new ASTSymbol(tok.lineno, tok.colno, name);
};

export const parseFilterArgs = (ctx, node) => {
  if (peekToken(ctx).type === lexer.TOKEN_LEFT_PAREN) {
    const call = ctx.parsePostfix(node);
    return call.args.children;
  }
  return [];
};

export const parsePipe = (ctx, node) => {
  while (skip(ctx, lexer.TOKEN_PIPEFORWARD)) {
    const name = parseFilterName(ctx);

    node = new Pipe(
      name.lineno,
      name.colno,
      name,
      new NodeList(
        name.lineno,
        name.colno,
        [node].concat(parseFilterArgs(ctx, node))
      )
    );
  }

  return node;
};
