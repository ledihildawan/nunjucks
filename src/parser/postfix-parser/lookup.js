import {
  TOKEN_COLON,
  TOKEN_RIGHT_BRACKET,
} from '../../lexer/token-types.js';
import { nodes, BracketNotation } from '../../nodes/index.js';
import { peekToken, skip, expect } from '../cursor.js';

export { BracketNotation };

const buildSlice = (ctx, bracketTok, start) => {
  let stop = null;
  let step = null;

  if (peekToken(ctx) && peekToken(ctx).type !== TOKEN_RIGHT_BRACKET &&
      peekToken(ctx).type !== TOKEN_COLON) {
    stop = ctx.parseExpression();
  }

  if (skip(ctx, TOKEN_COLON)) {
    if (peekToken(ctx) && peekToken(ctx).type !== TOKEN_RIGHT_BRACKET) {
      step = ctx.parseExpression();
    }
  }

  expect(ctx, TOKEN_RIGHT_BRACKET);
  const location = step || stop || start || bracketTok;
  const slice = nodes.slice(location.lineno, location.colno, start, stop, step);
  return slice;
};

export const parseBracketAccess = (ctx, bracketTok, target) => {
  if (skip(ctx, TOKEN_COLON)) {
    const slice = buildSlice(ctx, bracketTok, null);
    const node = nodes.lookupVal(bracketTok.lineno, bracketTok.colno, target, slice);
    node[BracketNotation] = true;
    return node;
  }

  const start = ctx.parseExpression();

  if (skip(ctx, TOKEN_COLON)) {
    const slice = buildSlice(ctx, bracketTok, start);
    const node = nodes.lookupVal(bracketTok.lineno, bracketTok.colno, target, slice);
    node[BracketNotation] = true;
    return node;
  }

  expect(ctx, TOKEN_RIGHT_BRACKET);
  const node = nodes.lookupVal(bracketTok.lineno, bracketTok.colno, target, start);
  node[BracketNotation] = true;
  return node;
};
