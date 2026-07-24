import {
  TOKEN_COLON,
  TOKEN_RIGHT_BRACKET,
} from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import { BracketNotation, lookupVal, slice } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skip, expect } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";

export { BracketNotation };

const buildSlice = (ctx: ParserContext, bracketTok: Token, start: Node | null): Node => {
  let stop: Node | null = null;
  let step: Node | null = null;

  if (peekToken(ctx) && peekToken(ctx).type !== TOKEN_RIGHT_BRACKET &&
      peekToken(ctx).type !== TOKEN_COLON) {
    stop = parseExpression(ctx);
  }

  if (skip(ctx, TOKEN_COLON) && peekToken(ctx) && peekToken(ctx).type !== TOKEN_RIGHT_BRACKET) {
      step = parseExpression(ctx);
    }

  expect(ctx, TOKEN_RIGHT_BRACKET);
  const location = step || stop || start || bracketTok;
  const sliceNode = slice(location.lineno, location.colno, start, stop, step);
  return sliceNode;
};

export const parseBracketAccess = (ctx: ParserContext, bracketTok: Token, target: Node): Node => {
  if (skip(ctx, TOKEN_COLON)) {
    const slice = buildSlice(ctx, bracketTok, null);
    const node = lookupVal(bracketTok.lineno, bracketTok.colno, target, slice);
    (node as Node & { [BracketNotation]?: boolean })[BracketNotation] = true;
    return node;
  }

  const start = parseExpression(ctx);

  if (skip(ctx, TOKEN_COLON)) {
    const slice = buildSlice(ctx, bracketTok, start);
    const node = lookupVal(bracketTok.lineno, bracketTok.colno, target, slice);
    (node as Node & { [BracketNotation]?: boolean })[BracketNotation] = true;
    return node;
  }

  expect(ctx, TOKEN_RIGHT_BRACKET);
  const node = lookupVal(bracketTok.lineno, bracketTok.colno, target, start);
  (node as Node & { [BracketNotation]?: boolean })[BracketNotation] = true;
  return node;
};
