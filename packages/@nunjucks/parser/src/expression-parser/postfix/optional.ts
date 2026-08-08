import {
  TOKEN_SYMBOL,
  TOKEN_LEFT_PAREN,
  TOKEN_RIGHT_PAREN,
  TOKEN_COMMA,
  TOKEN_LEFT_BRACKET,
  type TOKEN_OPERATOR,
} from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import { appendChild, literal, nodeList, optionalCall, optionalChain } from '@nunjucks/nodes';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import { nextToken, peekToken, fail } from "../../cursor.ts";
import type { ParserContext } from "../../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/shared';
import { parseExpression } from "../index.ts";
import { markBracketNotation } from "./lookup.ts";
import { loc } from '@nunjucks/shared';

type OptionalChainOperatorToken = Token & { type: typeof TOKEN_OPERATOR };

const isEndOfArgs = (next: Token): boolean =>
  !next || next.type === TOKEN_RIGHT_PAREN;

const handleComma = (parserContext: ParserContext, expectComma: boolean): Result<boolean, TemplateError> => {
  if (!expectComma) { return ok(true); }
  const nextR = peekToken(parserContext);
  if (isErr(nextR)) { return nextR; }
  if (nextR.value.type !== TOKEN_COMMA) {
    return fail(parserContext, 'expected comma after expression', nextR.value.lineno ?? 0, nextR.value.colno ?? 0);
  }
  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) { return consumedR; }
  return ok(true);
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Result unwrap-and-return short-circuits inflate branching
const parseOptionalCallArgs = (parserContext: ParserContext, tok: Token): Result<ChildrenNode, TemplateError> => {
  let args = nodeList(loc(tok));
  let expectComma = false;

  for (;;) {
    const nextR = peekToken(parserContext);
    if (isErr(nextR)) { return nextR; }
    const next = nextR.value;
    if (isEndOfArgs(next)) {
      if (next) {
        const consumedR = nextToken(parserContext);
        if (isErr(consumedR)) { return consumedR; }
      }
      break;
    }

    const commaR = handleComma(parserContext, expectComma);
    if (isErr(commaR)) { return commaR; }
    if (!commaR.value) { break; }

    const argumentR = parseExpression(parserContext);
    if (isErr(argumentR)) { return argumentR; }
    args = appendChild(args, argumentR.value);
    expectComma = true;
  }

  return ok(args);
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Result unwrap-and-return short-circuits inflate branching
export const parseOptionalChain = (parserContext: ParserContext, tok: OptionalChainOperatorToken, target: Node): Result<Node, TemplateError> => {
  const consumedOpR = nextToken(parserContext);
  if (isErr(consumedOpR)) { return consumedOpR; }
  const valueR = peekToken(parserContext);
  if (isErr(valueR)) { return valueR; }
  const value = valueR.value;

  if (value.type === TOKEN_LEFT_PAREN) {
    const consumedParenR = nextToken(parserContext);
    if (isErr(consumedParenR)) { return consumedParenR; }
    const argsR = parseOptionalCallArgs(parserContext, tok);
    if (isErr(argsR)) { return argsR; }
    return ok(optionalCall(loc(tok), { name: target, args: [...argsR.value.children] }));
  }

  if (value.type === TOKEN_LEFT_BRACKET) {
    const consumedBracketR = nextToken(parserContext);
    if (isErr(consumedBracketR)) { return consumedBracketR; }
    const startR = parseExpression(parserContext);
    if (isErr(startR)) { return startR; }

    const rightBracketR = nextToken(parserContext);
    if (isErr(rightBracketR)) { return rightBracketR; }
    if (rightBracketR.value.type !== 'right-bracket') {
      return fail(parserContext, 'expected right bracket', rightBracketR.value.lineno, rightBracketR.value.colno);
    }

    const node = optionalChain(loc(tok), { target, val: startR.value });
    markBracketNotation(node, true);
    return ok(node);
  }

  const nameTokR = nextToken(parserContext);
  if (isErr(nameTokR)) { return nameTokR; }
  const nameTok = nameTokR.value;

  if (nameTok.type !== TOKEN_SYMBOL) {
    const targetName = (target ? String(target.value ?? 'expression') : 'expression');
    return fail(parserContext, `expected name as lookup value after ?. on ${targetName}, got ${nameTok.value}`,
      nameTok.lineno,
      nameTok.colno);
  }

  const lookup = literal(loc(nameTok), nameTok.value);
  const node = optionalChain(loc(tok), { target, val: lookup });
  markBracketNotation(node, false);
  return ok(node);
};
