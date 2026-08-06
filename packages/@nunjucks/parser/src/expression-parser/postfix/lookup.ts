import {
  TOKEN_COLON,
  TOKEN_RIGHT_BRACKET,
} from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import { BracketNotation, lookupVal, slice } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skip, expect } from "../../cursor.ts";
import type { ParserContext } from "../../cursor.ts";
import { parseExpression } from "../index.ts";

// Stamp the bracket-notation flag on a lookup node in one place, so the symbol
// cast stays centralized instead of being repeated at every postfix site.
export const markBracketNotation = (node: Node, isBracket: boolean): void => {
  node[BracketNotation] = isBracket;
};

const buildSlice = (ctx: ParserContext, bracketTok: Token, start: Node | null): Node => {
  const peekedForStop = peekToken(ctx);
  const stop = peekedForStop?.type !== TOKEN_RIGHT_BRACKET &&
      peekedForStop.type !== TOKEN_COLON
    ? parseExpression(ctx)
    : null;

  const hasColon = skip(ctx, TOKEN_COLON);
  const peekedForStep = hasColon ? peekToken(ctx) : undefined;
  const step = hasColon && peekedForStep?.type !== TOKEN_RIGHT_BRACKET
    ? parseExpression(ctx)
    : null;

  expect(ctx, TOKEN_RIGHT_BRACKET);
  const location = step || stop || start || bracketTok;
  const sliceNode = slice(location.lineno, location.colno, { start, stop, step });
  return sliceNode;
};

const parseBracketAccess = (ctx: ParserContext, bracketTok: Token, target: Node): Node => {
  if (skip(ctx, TOKEN_COLON)) {
    const sliceNode = buildSlice(ctx, bracketTok, null);
    const node = lookupVal(bracketTok.lineno, bracketTok.colno, target, sliceNode);
    markBracketNotation(node, true);
    return node;
  }

  const start = parseExpression(ctx);

  if (skip(ctx, TOKEN_COLON)) {
    const sliceNode = buildSlice(ctx, bracketTok, start);
    const node = lookupVal(bracketTok.lineno, bracketTok.colno, target, sliceNode);
    markBracketNotation(node, true);
    return node;
  }

  expect(ctx, TOKEN_RIGHT_BRACKET);
  const node = lookupVal(bracketTok.lineno, bracketTok.colno, target, start);
  markBracketNotation(node, true);
  return node;
};

export { parseBracketAccess };

export { BracketNotation } from '@nunjucks/nodes';
