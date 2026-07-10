import {
  TOKEN_COLON,
  TOKEN_RIGHT_BRACKET,
} from '../../lexer/token-types.js';
import { LookupVal, Slice } from '../../nodes/index.js';
import { peekToken, skip, expect } from '../cursor.js';

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
  const sliceTok = peekToken(ctx);
  const slice = new Slice(sliceTok.lineno, sliceTok.colno, start, stop, step);
  return slice;
};

export const parseBracketAccess = (ctx, bracketTok, target) => {
  if (skip(ctx, TOKEN_COLON)) {
    const slice = buildSlice(ctx, bracketTok, null);
    return new LookupVal(bracketTok.lineno, bracketTok.colno, target, slice);
  }

  const start = ctx.parseExpression();

  if (skip(ctx, TOKEN_COLON)) {
    const slice = buildSlice(ctx, bracketTok, start);
    return new LookupVal(bracketTok.lineno, bracketTok.colno, target, slice);
  }

  expect(ctx, TOKEN_RIGHT_BRACKET);
  return new LookupVal(bracketTok.lineno, bracketTok.colno, target, start);
};
