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
import type { TemplateError } from '@nunjucks/error-formatter';
import { nextToken, peekToken, fail } from "../../cursor.ts";
import type { ParserContext } from "../../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/lib';
import { parseExpression } from "../index.ts";
import { markBracketNotation } from "./lookup.ts";
import { loc } from '@nunjucks/lexer';

type OptionalChainOperatorToken = Token & { type: typeof TOKEN_OPERATOR };

const isEndOfArgs = (next: Token): boolean =>
  !next || next.type === TOKEN_RIGHT_PAREN;

const handleComma = (parserContext: ParserContext, expectComma: boolean): Result<boolean, TemplateError> => {
  if (!expectComma) { return ok(true); }
  const nextR = peekToken(parserContext);
  if (isErr(nextR)) { return nextR; }
  if (nextR.value.type !== TOKEN_COMMA) {
    return fail(parserContext, 'expected comma after expression', { lineno: nextR.value.lineno ?? 0, colno: nextR.value.colno ?? 0 });
  }
  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) { return consumedR; }
  return ok(true);
};

const consumeEndOfArgs = (parserContext: ParserContext, next: Token): Result<boolean, TemplateError> => {
  if (!isEndOfArgs(next)) { return ok(false); }
  if (next) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
  }
  return ok(true);
};

const parseOptionalCallArgs = (parserContext: ParserContext, tok: Token): Result<ChildrenNode, TemplateError> => {
  const parseLoop = (args: ChildrenNode, expectComma: boolean): Result<ChildrenNode, TemplateError> => {
    const nextR = peekToken(parserContext);
    if (isErr(nextR)) { return nextR; }
    const next = nextR.value;

    const endR = consumeEndOfArgs(parserContext, next);
    if (isErr(endR)) { return endR; }
    if (endR.value) { return ok(args); }

    const commaR = handleComma(parserContext, expectComma);
    if (isErr(commaR)) { return commaR; }
    if (!commaR.value) { return ok(args); }

    const argumentR = parseExpression(parserContext);
    if (isErr(argumentR)) { return argumentR; }
    return parseLoop(appendChild(args, argumentR.value), true);
  };

  return parseLoop(nodeList(loc(tok)), false);
};

const parseOptionalCall = (parserContext: ParserContext, tok: Token, target: Node): Result<Node, TemplateError> => {
  const consumedParenR = nextToken(parserContext);
  if (isErr(consumedParenR)) { return consumedParenR; }
  const argsR = parseOptionalCallArgs(parserContext, tok);
  if (isErr(argsR)) { return argsR; }
  return ok(optionalCall(loc(tok), { name: target, args: [...argsR.value.children] }));
};

const parseOptionalBracket = (parserContext: ParserContext, tok: Token, target: Node): Result<Node, TemplateError> => {
  const consumedBracketR = nextToken(parserContext);
  if (isErr(consumedBracketR)) { return consumedBracketR; }
  const startR = parseExpression(parserContext);
  if (isErr(startR)) { return startR; }

  const rightBracketR = nextToken(parserContext);
  if (isErr(rightBracketR)) { return rightBracketR; }
  if (rightBracketR.value.type !== 'right-bracket') {
    return fail(parserContext, 'expected right bracket', { lineno: rightBracketR.value.lineno, colno: rightBracketR.value.colno });
  }

  const node = optionalChain(loc(tok), { target, val: startR.value });
  markBracketNotation(node, true);
  return ok(node);
};

const parseOptionalLookup = (parserContext: ParserContext, tok: Token, target: Node): Result<Node, TemplateError> => {
  const nameTokR = nextToken(parserContext);
  if (isErr(nameTokR)) { return nameTokR; }
  const nameTok = nameTokR.value;

  if (nameTok.type !== TOKEN_SYMBOL) {
    const targetName = (target ? String(target.value ?? 'expression') : 'expression');
    return fail(parserContext, `expected name as lookup value after ?. on ${targetName}, got ${nameTok.value}`, { lineno: nameTok.lineno, colno: nameTok.colno });
  }

  const lookup = literal(loc(nameTok), nameTok.value);
  const node = optionalChain(loc(tok), { target, val: lookup });
  markBracketNotation(node, false);
  return ok(node);
};

export const parseOptionalChain = (parserContext: ParserContext, tok: OptionalChainOperatorToken, target: Node): Result<Node, TemplateError> => {
  const consumedOpR = nextToken(parserContext);
  if (isErr(consumedOpR)) { return consumedOpR; }
  const valueR = peekToken(parserContext);
  if (isErr(valueR)) { return valueR; }
  const value = valueR.value;

  if (value.type === TOKEN_LEFT_PAREN) {
    return parseOptionalCall(parserContext, tok, target);
  }
  if (value.type === TOKEN_LEFT_BRACKET) {
    return parseOptionalBracket(parserContext, tok, target);
  }
  return parseOptionalLookup(parserContext, tok, target);
};
