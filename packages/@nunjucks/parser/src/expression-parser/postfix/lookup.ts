import {
  TOKEN_COLON,
  TOKEN_RIGHT_BRACKET,
  type TOKEN_LEFT_BRACKET,
} from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import { BracketNotation, lookupVal, slice } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { peekToken, skip, expect } from "../../cursor.ts";
import type { ParserContext } from "../../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/lib';
import { parseExpression } from "../index.ts";
import { loc } from '@nunjucks/lexer';

type LeftBracketToken = Token & { type: typeof TOKEN_LEFT_BRACKET };

export const markBracketNotation = (node: Node, isBracket: boolean): void => {
  node[BracketNotation] = isBracket;
};

const buildSlice = (parserContext: ParserContext, bracketTok: LeftBracketToken, start: Node | null): Result<Node, TemplateError> => {
  const peekedStopR = peekToken(parserContext);
  if (isErr(peekedStopR)) { return peekedStopR; }
  let stop: Node | null = null;
  if (peekedStopR.value.type !== TOKEN_RIGHT_BRACKET && peekedStopR.value.type !== TOKEN_COLON) {
    const stopR = parseExpression(parserContext);
    if (isErr(stopR)) { return stopR; }
    stop = stopR.value;
  }

  const hasColon = skip(parserContext, TOKEN_COLON);
  let step: Node | null = null;
  if (hasColon) {
    const peekedStepR = peekToken(parserContext);
    if (isErr(peekedStepR)) { return peekedStepR; }
    if (peekedStepR.value.type !== TOKEN_RIGHT_BRACKET) {
      const stepR = parseExpression(parserContext);
      if (isErr(stepR)) { return stepR; }
      step = stepR.value;
    }
  }

  const endR = expect(parserContext, TOKEN_RIGHT_BRACKET);
  if (isErr(endR)) { return endR; }
  const location = step || stop || start || bracketTok;
  const sliceNode = slice(loc(location), { start, stop, step });
  return ok(sliceNode);
};

const parseBracketAccess = (parserContext: ParserContext, bracketTok: LeftBracketToken, target: Node): Result<Node, TemplateError> => {
  if (skip(parserContext, TOKEN_COLON)) {
    const sliceR = buildSlice(parserContext, bracketTok, null);
    if (isErr(sliceR)) { return sliceR; }
    const node = lookupVal(loc(bracketTok), { target, val: sliceR.value });
    markBracketNotation(node, true);
    return ok(node);
  }

  const startR = parseExpression(parserContext);
  if (isErr(startR)) { return startR; }

  if (skip(parserContext, TOKEN_COLON)) {
    const sliceR = buildSlice(parserContext, bracketTok, startR.value);
    if (isErr(sliceR)) { return sliceR; }
    const node = lookupVal(loc(bracketTok), { target, val: sliceR.value });
    markBracketNotation(node, true);
    return ok(node);
  }

  const endR = expect(parserContext, TOKEN_RIGHT_BRACKET);
  if (isErr(endR)) { return endR; }
  const node = lookupVal(loc(bracketTok), { target, val: startR.value });
  markBracketNotation(node, true);
  return ok(node);
};

export { parseBracketAccess };
