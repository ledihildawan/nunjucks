import * as lexer from '../../lexer/index.js';
import { LookupVal, Slice } from '../../nodes.js';
import { peekToken, skip, expect } from '../cursor.js';

const buildSlice = (ctx, bracketTok, start) => {
  let stop = null;
  let step = null;

  if (peekToken(ctx) && peekToken(ctx).type !== lexer.TOKEN_RIGHT_BRACKET &&
      peekToken(ctx).type !== lexer.TOKEN_COLON) {
    stop = ctx.parseExpression();
  }

  if (skip(ctx, lexer.TOKEN_COLON)) {
    if (peekToken(ctx) && peekToken(ctx).type !== lexer.TOKEN_RIGHT_BRACKET) {
      step = ctx.parseExpression();
    }
  }

  expect(ctx, lexer.TOKEN_RIGHT_BRACKET);
  const sliceTok = peekToken(ctx);
  const slice = new Slice(sliceTok.lineno, sliceTok.colno, start, stop, step);
  return slice;
};

export const parseBracketAccess = (ctx, bracketTok, target) => {
  if (skip(ctx, lexer.TOKEN_COLON)) {
    const slice = buildSlice(ctx, bracketTok, null);
    return new LookupVal(bracketTok.lineno, bracketTok.colno, target, slice);
  }

  const start = ctx.parseExpression();

  if (skip(ctx, lexer.TOKEN_COLON)) {
    const slice = buildSlice(ctx, bracketTok, start);
    return new LookupVal(bracketTok.lineno, bracketTok.colno, target, slice);
  }

  expect(ctx, lexer.TOKEN_RIGHT_BRACKET);
  return new LookupVal(bracketTok.lineno, bracketTok.colno, target, start);
};
