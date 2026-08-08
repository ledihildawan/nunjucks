import {
  TOKEN_COLON,
  TOKEN_RIGHT_BRACKET,
  type TOKEN_LEFT_BRACKET,
} from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import { BracketNotation, lookupVal, slice } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skip, expect } from "../../cursor.ts";
import type { ParserContext } from "../../cursor.ts";
import { parseExpression } from "../index.ts";
import { loc } from '@nunjucks/shared';

type LeftBracketToken = Token & { type: typeof TOKEN_LEFT_BRACKET };

export const markBracketNotation = (node: Node, isBracket: boolean): void => {
  node[BracketNotation] = isBracket;
};

const buildSlice = (parserContext: ParserContext, bracketTok: LeftBracketToken, start: Node | null): Node => {
  const peekedForStop = peekToken(parserContext);
  const stop = peekedForStop?.type !== TOKEN_RIGHT_BRACKET &&
      peekedForStop.type !== TOKEN_COLON
    ? parseExpression(parserContext)
    : null;

  const hasColon = skip(parserContext, TOKEN_COLON);
  const peekedForStep = hasColon ? peekToken(parserContext) : undefined;
  const step = hasColon && peekedForStep?.type !== TOKEN_RIGHT_BRACKET
    ? parseExpression(parserContext)
    : null;

  expect(parserContext, TOKEN_RIGHT_BRACKET);
  const location = step || stop || start || bracketTok;
  const sliceNode = slice(loc(location), { start, stop, step });
  return sliceNode;
};

const parseBracketAccess = (parserContext: ParserContext, bracketTok: LeftBracketToken, target: Node): Node => {
  if (skip(parserContext, TOKEN_COLON)) {
    const sliceNode = buildSlice(parserContext, bracketTok, null);
    const node = lookupVal(loc(bracketTok), { target, val: sliceNode });
    markBracketNotation(node, true);
    return node;
  }

  const start = parseExpression(parserContext);

  if (skip(parserContext, TOKEN_COLON)) {
    const sliceNode = buildSlice(parserContext, bracketTok, start);
    const node = lookupVal(loc(bracketTok), { target, val: sliceNode });
    markBracketNotation(node, true);
    return node;
  }

  expect(parserContext, TOKEN_RIGHT_BRACKET);
  const node = lookupVal(loc(bracketTok), { target, val: start });
  markBracketNotation(node, true);
  return node;
};

export { parseBracketAccess };

export { BracketNotation } from '@nunjucks/nodes';
