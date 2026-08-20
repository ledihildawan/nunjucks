import type { TemplateError } from '@nunjucks/error-formatter';
import type { Token } from '@nunjucks/lexer';
import { TOKEN_COLON, type TOKEN_LEFT_BRACKET, TOKEN_RIGHT_BRACKET } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { BracketNotation, lookupVal, slice } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../../cursor.ts';
import { expect, peekToken, skip } from '../../cursor.ts';

type LeftBracketToken = Token & { type: typeof TOKEN_LEFT_BRACKET };

const markBracketNotation = (node: Node, isBracket: boolean): void => {
  node[BracketNotation] = isBracket;
};

const buildSlice = (
  parserContext: ParserContext,
  bracketTok: LeftBracketToken,
  start: Node | null
): Result<Node, TemplateError> => {
  const peekedStopR = peekToken(parserContext);
  if (isErr(peekedStopR)) {
    return peekedStopR;
  }
  let stop: Node | null = null;
  if (peekedStopR.value.type !== TOKEN_RIGHT_BRACKET && peekedStopR.value.type !== TOKEN_COLON) {
    const stopR = parserContext.parseExpression();
    if (isErr(stopR)) {
      return stopR;
    }
    stop = stopR.value;
  }

  const hasColon = skip(parserContext, TOKEN_COLON);
  let step: Node | null = null;
  if (hasColon) {
    const peekedStepR = peekToken(parserContext);
    if (isErr(peekedStepR)) {
      return peekedStepR;
    }
    if (peekedStepR.value.type !== TOKEN_RIGHT_BRACKET) {
      const stepR = parserContext.parseExpression();
      if (isErr(stepR)) {
        return stepR;
      }
      step = stepR.value;
    }
  }

  const endR = expect(parserContext, TOKEN_RIGHT_BRACKET);
  if (isErr(endR)) {
    return endR;
  }
  const location = step || stop || start || bracketTok;
  const sliceNode = slice(loc(location), { start, stop, step });
  return ok(sliceNode);
};

/**
 * Parses `[...]` subscript access on `target`: a plain index expression or
 * a `start:stop:step` slice, marked as bracket notation for round-tripping.
 */
const parseBracketAccess = (
  parserContext: ParserContext,
  bracketTok: LeftBracketToken,
  target: Node
): Result<Node, TemplateError> => {
  if (skip(parserContext, TOKEN_COLON)) {
    const sliceR = buildSlice(parserContext, bracketTok, null);
    if (isErr(sliceR)) {
      return sliceR;
    }
    const node = lookupVal(loc(bracketTok), { target, val: sliceR.value });
    markAsBracket(node);
    return ok(node);
  }

  const startR = parserContext.parseExpression();
  if (isErr(startR)) {
    return startR;
  }

  if (skip(parserContext, TOKEN_COLON)) {
    const sliceR = buildSlice(parserContext, bracketTok, startR.value);
    if (isErr(sliceR)) {
      return sliceR;
    }
    const node = lookupVal(loc(bracketTok), { target, val: sliceR.value });
    markAsBracket(node);
    return ok(node);
  }

  const endR = expect(parserContext, TOKEN_RIGHT_BRACKET);
  if (isErr(endR)) {
    return endR;
  }
  const node = lookupVal(loc(bracketTok), { target, val: startR.value });
  markAsBracket(node);
  return ok(node);
};

/** Marks a lookup node as produced by bracket notation, e.g. `a["b"]`. */
const markAsBracket = (node: Node): void => {
  markBracketNotation(node, true);
};
/** Marks a lookup node as produced by dot notation, e.g. `a.b`. */
const markAsDot = (node: Node): void => {
  markBracketNotation(node, false);
};

export { markAsBracket, markAsDot, parseBracketAccess };
