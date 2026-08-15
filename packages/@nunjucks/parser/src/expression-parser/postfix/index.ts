import type { TemplateError } from '@nunjucks/error-formatter';
import type { Token } from '@nunjucks/lexer';
import { TOKEN_LEFT_BRACKET, TOKEN_LEFT_PAREN, TOKEN_OPERATOR } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node } from '@nunjucks/nodes';
import { decrement, increment } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../../cursor.ts';
import { nextToken, peekToken } from '../../cursor.ts';
import { parseDotAccess } from './dot.ts';
import { parseFunCall } from './fun-call.ts';
import { parseBracketAccess } from './lookup.ts';
import { parseOptionalChain } from './optional.ts';

type OperatorToken = Token & { type: typeof TOKEN_OPERATOR };

const applyPostfixOperator = (
  parserContext: ParserContext,
  tok: OperatorToken,
  current: Node
): Result<{ node: Node; stop: boolean }, TemplateError> => {
  if (tok.value === '.') {
    const parseResult = parseDotAccess(parserContext, tok, current);
    if (isErr(parseResult)) {
      return parseResult;
    }
    return ok({ node: parseResult.value, stop: false });
  }
  if (tok.value === '?.') {
    const parseResult = parseOptionalChain(parserContext, tok, current);
    if (isErr(parseResult)) {
      return parseResult;
    }
    return ok({ node: parseResult.value, stop: false });
  }
  if (tok.value === '++') {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
    return ok({ node: increment(loc(tok), { target: current, isPostfix: true }), stop: false });
  }
  if (tok.value === '--') {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
    return ok({ node: decrement(loc(tok), { target: current, isPostfix: true }), stop: false });
  }
  return ok({ node: current, stop: true });
};

const applyPostfixStep = (
  parserContext: ParserContext,
  current: Node
): Result<{ node: Node; stop: boolean }, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;

  if (tok.type === TOKEN_LEFT_PAREN) {
    const parseResult = parseFunCall(parserContext, tok, current);
    if (isErr(parseResult)) {
      return parseResult;
    }
    return ok({ node: parseResult.value, stop: false });
  }
  if (tok.type === TOKEN_LEFT_BRACKET) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
    const parseResult = parseBracketAccess(parserContext, tok, current);
    if (isErr(parseResult)) {
      return parseResult;
    }
    return ok({ node: parseResult.value, stop: false });
  }
  if (tok.type === TOKEN_OPERATOR) {
    return applyPostfixOperator(parserContext, tok, current);
  }
  return ok({ node: current, stop: true });
};

export const parsePostfix = (
  parserContext: ParserContext,
  node: Node
): Result<Node, TemplateError> => {
  const parseLoop = (current: Node): Result<Node, TemplateError> => {
    const stepR = applyPostfixStep(parserContext, current);
    if (isErr(stepR)) {
      return stepR;
    }
    if (stepR.value.stop) {
      return ok(stepR.value.node);
    }
    return parseLoop(stepR.value.node);
  };
  return parseLoop(node);
};

export { parseFilterCallArgs, parseFilterCallName, parsePipeForward } from './pipe-forward.ts';
