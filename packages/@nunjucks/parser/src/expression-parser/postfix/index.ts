import type { Token } from '@nunjucks/lexer';
import {
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_PAREN,
  TOKEN_OPERATOR,
} from '@nunjucks/lexer';
import { decrement, increment } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { nextToken, peekToken } from "../../cursor.ts";
import type { ParserContext } from "../../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/lib';
import { parseFunCall } from "./fun-call.ts";
import { parseBracketAccess } from "./lookup.ts";
import { parseDotAccess } from "./dot.ts";
import { parseOptionalChain } from "./optional.ts";
import { loc } from '@nunjucks/shared';

type OperatorToken = Token & { type: typeof TOKEN_OPERATOR };

const applyPostfixOperator = (parserContext: ParserContext, tok: OperatorToken, current: Node): Result<{ node: Node; stop: boolean }, TemplateError> => {
  if (tok.value === '.') {
    const r = parseDotAccess(parserContext, tok, current);
    if (isErr(r)) { return r; }
    return ok({ node: r.value, stop: false });
  }
  if (tok.value === '?.') {
    const r = parseOptionalChain(parserContext, tok, current);
    if (isErr(r)) { return r; }
    return ok({ node: r.value, stop: false });
  }
  if (tok.value === '++') {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
    return ok({ node: increment(loc(tok), { target: current, isPostfix: true }), stop: false });
  }
  if (tok.value === '--') {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
    return ok({ node: decrement(loc(tok), { target: current, isPostfix: true }), stop: false });
  }
  return ok({ node: current, stop: true });
};

const applyPostfixStep = (parserContext: ParserContext, current: Node): Result<{ node: Node; stop: boolean }, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;

  if (tok.type === TOKEN_LEFT_PAREN) {
    const r = parseFunCall(parserContext, tok, current);
    if (isErr(r)) { return r; }
    return ok({ node: r.value, stop: false });
  }
  if (tok.type === TOKEN_LEFT_BRACKET) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
    const r = parseBracketAccess(parserContext, tok, current);
    if (isErr(r)) { return r; }
    return ok({ node: r.value, stop: false });
  }
  if (tok.type === TOKEN_OPERATOR) {
    return applyPostfixOperator(parserContext, tok, current);
  }
  return ok({ node: current, stop: true });
};

export const parsePostfix = (parserContext: ParserContext, node: Node): Result<Node, TemplateError> => {
  const parseLoop = (current: Node): Result<Node, TemplateError> => {
    const stepR = applyPostfixStep(parserContext, current);
    if (isErr(stepR)) { return stepR; }
    if (stepR.value.stop) { return ok(stepR.value.node); }
    return parseLoop(stepR.value.node);
  };
  return parseLoop(node);
};

export { parsePipeForward, parseFilterCallName, parseFilterCallArgs } from './pipe-forward.ts';
