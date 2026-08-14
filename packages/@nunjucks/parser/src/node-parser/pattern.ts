// biome-ignore lint/style/noExcessiveLinesPerFile: Result unwrap boilerplate inflates line count
import {
  TOKEN_COLON,
  TOKEN_COMMA,
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_CURLY,
  TOKEN_RIGHT_BRACKET,
  TOKEN_RIGHT_CURLY,
  TOKEN_SPREAD,
  TOKEN_OPERATOR,
  TOKEN_STRING,
  TOKEN_SYMBOL,
  type Token,
  isSymbolToken,
} from '@nunjucks/lexer';
import { appendChild, arrayPattern, assignmentPattern, hole, objectPattern, patternProperty, restPattern, symbol } from '@nunjucks/nodes';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import type { Loc } from '@nunjucks/shared';
import type { TemplateError } from '@nunjucks/error-formatter';
import { nextToken, peekToken, peekTokenOrNull, skip, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/lib';
import { parseExpression } from "../expression-parser/index.ts";
import { loc } from '@nunjucks/lexer';

const isDestructuringStart = (parserContext: ParserContext): boolean => {
  const tok = peekTokenOrNull(parserContext);
  return tok !== null && (tok.type === TOKEN_LEFT_BRACKET || tok.type === TOKEN_LEFT_CURLY);
};

const parseInnerPattern = (parserContext: ParserContext): Result<Node, TemplateError> => {
  if (isDestructuringStart(parserContext)) {
    const nodeR = parsePattern(parserContext);
    if (isErr(nodeR)) { return nodeR; }
    if (nodeR.value) {
      return ok(nodeR.value);
    }
  }
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;
  if (tok?.type === TOKEN_SYMBOL) {
    const symbolTokR = nextToken(parserContext);
    if (isErr(symbolTokR)) { return symbolTokR; }
    const symbolTok = symbolTokR.value;
    return ok(symbol(loc(symbolTok), isSymbolToken(symbolTok) ? symbolTok.value : String(symbolTok.value)));
  }
  return fail(parserContext, 'parseInnerPattern: expected symbol or pattern',
    { lineno: tok?.lineno ?? 0, colno: tok?.colno ?? 0 });
};

const parseAssignmentDefault = (parserContext: ParserContext, target: Node): Result<Node | null, TemplateError> => {
  const peeked = peekTokenOrNull(parserContext);
  if (peeked?.type === TOKEN_OPERATOR && peeked?.value === '=') {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
    const defaultExprR = parseExpression(parserContext);
    if (isErr(defaultExprR)) { return defaultExprR; }
    return ok(assignmentPattern(loc(target), { target, defaultVal: defaultExprR.value }));
  }
  return ok(null);
};

const parseArrayRestElement = (parserContext: ParserContext, node: ChildrenNode, tok: Token): Result<{ node: ChildrenNode; sawRest: boolean }, TemplateError> => {
  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) { return consumedR; }
  const innerR = parseInnerPattern(parserContext);
  if (isErr(innerR)) { return innerR; }
  const rp = restPattern(loc(tok), innerR.value);
  return ok({ node: appendChild(node, rp), sawRest: true });
};

const parseNestedPatternElement = (parserContext: ParserContext, peeked: Token): Result<Node, TemplateError> => {
  const origin = loc(peeked);
  if (peeked.type === TOKEN_LEFT_BRACKET) {
    return parseArrayPattern(parserContext, origin);
  }
  return parseObjectPattern(parserContext, origin);
};

const parseArrayNestedElement = ({ parserContext, node, peeked, sawRest }: { parserContext: ParserContext; node: ChildrenNode; peeked: Token; sawRest: boolean }): Result<{ node: ChildrenNode; sawRest: boolean }, TemplateError> => {
  const innerR = parseNestedPatternElement(parserContext, peeked);
  if (isErr(innerR)) { return innerR; }
  const withDefaultR = parseAssignmentDefault(parserContext, innerR.value);
  if (isErr(withDefaultR)) { return withDefaultR; }
  return ok({ node: appendChild(node, withDefaultR.value ?? innerR.value), sawRest });
};

const parseArraySymbolElement = ({ parserContext, node, tok, sawRest }: { parserContext: ParserContext; node: ChildrenNode; tok: Token; sawRest: boolean }): Result<{ node: ChildrenNode; sawRest: boolean }, TemplateError> => {
  const symTokR = nextToken(parserContext);
  if (isErr(symTokR)) { return symTokR; }
  const symTok = symTokR.value;
  if (!symTok || symTok.type !== TOKEN_SYMBOL) {
    return fail(parserContext, 'parseArrayPattern: expected symbol in pattern',
      { lineno: symTok?.lineno ?? tok.lineno, colno: symTok?.colno ?? tok.colno });
  }
  const target = symbol(loc(symTok), symTok.value);
  const withDefaultR = parseAssignmentDefault(parserContext, target);
  if (isErr(withDefaultR)) { return withDefaultR; }
  return ok({ node: appendChild(node, withDefaultR.value ?? target), sawRest });
};

const handleArrayElement = ({ parserContext, node, tok, sawRest }: { parserContext: ParserContext; node: ChildrenNode; tok: Token; sawRest: boolean }): Result<{ node: ChildrenNode; sawRest: boolean }, TemplateError> => {
  const peekedR = peekToken(parserContext);
  if (isErr(peekedR)) { return peekedR; }
  const peeked = peekedR.value;

  if (peeked.type === TOKEN_SPREAD) {
    return parseArrayRestElement(parserContext, node, tok);
  }
  if (peeked.type === TOKEN_LEFT_BRACKET || peeked.type === TOKEN_LEFT_CURLY) {
    return parseArrayNestedElement({ parserContext, node, peeked, sawRest });
  }
  return parseArraySymbolElement({ parserContext, node, tok, sawRest });
};

interface TrailingCommaConfig {
  terminationToken: Token['type'];
  label: string;
}

const handleTrailingComma = (
  { terminationToken, label }: TrailingCommaConfig,
  parserContext: ParserContext,
  tok: Token,
  node: ChildrenNode,
  sawRest: boolean
): Result<{ node: ChildrenNode; sawRest: boolean; continueLoop: boolean }, TemplateError> => {
  if ((node.children?.length ?? 0) > 0 && !sawRest) {
    if (!skip(parserContext, TOKEN_COMMA)) {
      return fail(parserContext, `${label}: expected comma`, { lineno: tok.lineno, colno: tok.colno });
    }
    const afterR = peekToken(parserContext);
    if (isErr(afterR)) { return afterR; }
    const after = afterR.value;
    if (after.type === terminationToken) {
      const consumedR = nextToken(parserContext);
      if (isErr(consumedR)) { return consumedR; }
      return ok({ node, sawRest, continueLoop: false });
    }
    if (after.type === TOKEN_COMMA) {
      return ok({ node: appendChild(node, hole(loc(after))), sawRest, continueLoop: true });
    }
  }
  return ok({ node, sawRest, continueLoop: true });
};

const handleArrayTrailingComma = (
  parserContext: ParserContext,
  tok: Token,
  node: ChildrenNode,
  sawRest: boolean
): Result<{ node: ChildrenNode; sawRest: boolean; continueLoop: boolean }, TemplateError> =>
  handleTrailingComma({ terminationToken: TOKEN_RIGHT_BRACKET, label: 'parseArrayPattern' }, parserContext, tok, node, sawRest);

const handleObjectTrailingComma = (
  parserContext: ParserContext,
  tok: Token,
  node: ChildrenNode,
  sawRest: boolean
): Result<{ node: ChildrenNode; sawRest: boolean; continueLoop: boolean }, TemplateError> =>
  handleTrailingComma({ terminationToken: TOKEN_RIGHT_CURLY, label: 'parseObjectPattern' }, parserContext, tok, node, sawRest);

const consumeComma = (parserContext: ParserContext): Result<boolean, TemplateError> => {
  if (peekTokenOrNull(parserContext)?.type !== TOKEN_COMMA) {
    return ok(false);
  }
  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) { return consumedR; }
  return ok(true);
};

const parseArrayIteration = ({
  parserContext,
  initialNode,
  initialSawRest,
  skipTrailingCommaCheck,
}: {
  parserContext: ParserContext;
  initialNode: ChildrenNode;
  initialSawRest: boolean;
  skipTrailingCommaCheck: boolean;
}): Result<{ node: ChildrenNode; sawRest: boolean; skipCommaNext: boolean; done: boolean }, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;
  if (tok.type === TOKEN_RIGHT_BRACKET) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
    return ok({ node: initialNode, sawRest: initialSawRest, skipCommaNext: false, done: true });
  }

  let node = initialNode;
  let sawRest = initialSawRest;
  if (!skipTrailingCommaCheck) {
    const commaResult = handleArrayTrailingComma(parserContext, tok, node, sawRest);
    if (isErr(commaResult)) { return commaResult; }
    if (!commaResult.value.continueLoop) {
      return ok({ node: commaResult.value.node, sawRest: commaResult.value.sawRest, skipCommaNext: false, done: true });
    }
    node = commaResult.value.node;
    sawRest = commaResult.value.sawRest;
  }

  const result = handleArrayElement({ parserContext, node, tok, sawRest });
  if (isErr(result)) { return result; }
  node = result.value.node;
  sawRest = result.value.sawRest;

  const consumedCommaR = consumeComma(parserContext);
  if (isErr(consumedCommaR)) { return consumedCommaR; }
  return ok({ node, sawRest, skipCommaNext: consumedCommaR.value, done: false });
};

const parseArrayPattern = (parserContext: ParserContext, origin: Loc): Result<Node, TemplateError> => {
  const node = arrayPattern(origin);
  const startTokR = nextToken(parserContext);
  if (isErr(startTokR)) { return startTokR; }
  if (startTokR.value.type !== TOKEN_LEFT_BRACKET) {
    return fail(parserContext, 'parseArrayPattern: expected [', { lineno: origin.lineno, colno: origin.colno });
  }

  const parseLoop = (
    current: ChildrenNode,
    sawRest: boolean,
    skipTrailingCommaCheck: boolean
  ): Result<Node, TemplateError> => {
    const iterR = parseArrayIteration({ parserContext, initialNode: current, initialSawRest: sawRest, skipTrailingCommaCheck });
    if (isErr(iterR)) { return iterR; }
    if (iterR.value.done) {
      return ok(iterR.value.node);
    }
    return parseLoop(iterR.value.node, iterR.value.sawRest, iterR.value.skipCommaNext);
  };

  return parseLoop(node, false, false);
};

const parseObjectPropertyKey = (parserContext: ParserContext): Result<{ keyTok: Token; keyName: string }, TemplateError> => {
  const keyTokR = nextToken(parserContext);
  if (isErr(keyTokR)) { return keyTokR; }
  const keyTok = keyTokR.value;
  if (keyTok.type !== TOKEN_STRING && keyTok.type !== TOKEN_SYMBOL) {
    return fail(parserContext, 'parseObjectPattern: expected property name',
      { lineno: keyTok.lineno, colno: keyTok.colno });
  }
  const keyName = String(keyTok.value);
  return ok({ keyTok, keyName });
};

const parseObjectPropertyValue = (parserContext: ParserContext, keyTok: Token, keyName: string): Result<Node, TemplateError> => {
  if (skip(parserContext, TOKEN_COLON)) {
    const innerTok = peekTokenOrNull(parserContext);
    if (innerTok?.type === TOKEN_LEFT_BRACKET) {
      return parseArrayPattern(parserContext, loc(innerTok));
    }
    if (innerTok?.type === TOKEN_LEFT_CURLY) {
      return parseObjectPattern(parserContext, loc(innerTok));
    }
    return parseInnerPattern(parserContext);
  }
  return ok(symbol(loc(keyTok), keyName));
};

const handleObjectSpread = (parserContext: ParserContext, node: ChildrenNode, sawRest: boolean): Result<{ node: ChildrenNode; sawRest: boolean }, TemplateError> => {
  if (peekTokenOrNull(parserContext)?.type === TOKEN_SPREAD) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
    const tokR = peekToken(parserContext);
    if (isErr(tokR)) { return tokR; }
    const tok = tokR.value;
    const innerR = parseInnerPattern(parserContext);
    if (isErr(innerR)) { return innerR; }
    return ok({ node: appendChild(node, restPattern(loc(tok), innerR.value)), sawRest: true });
  }
  return ok({ node, sawRest });
};

const parseObjectPatternProperty = (parserContext: ParserContext, node: ChildrenNode): Result<ChildrenNode, TemplateError> => {
  const keyR = parseObjectPropertyKey(parserContext);
  if (isErr(keyR)) { return keyR; }
  const { keyTok, keyName } = keyR.value;
  const valueTargetR = parseObjectPropertyValue(parserContext, keyTok, keyName);
  if (isErr(valueTargetR)) { return valueTargetR; }
  const valueTarget = valueTargetR.value;
  const withDefaultR = parseAssignmentDefault(parserContext, valueTarget);
  if (isErr(withDefaultR)) { return withDefaultR; }
  return ok(appendChild(node, patternProperty(
    loc(keyTok),
    { key: symbol(loc(keyTok), keyName), val: withDefaultR.value ?? valueTarget }
  )));
};

const tryObjectSpreadTerminator = (
  parserContext: ParserContext,
  node: ChildrenNode,
  sawRest: boolean
): Result<{ node: ChildrenNode } | null, TemplateError> => {
  const spreadResult = handleObjectSpread(parserContext, node, sawRest);
  if (isErr(spreadResult)) { return spreadResult; }
  if (!spreadResult.value.sawRest) {
    return ok(null);
  }
  const commaR = consumeComma(parserContext);
  if (isErr(commaR)) { return commaR; }
  return ok({ node: spreadResult.value.node });
};

const parseObjectIteration = ({ parserContext, node, sawRest }: { parserContext: ParserContext; node: ChildrenNode; sawRest: boolean }): Result<{ node: ChildrenNode; sawRest: boolean; done: boolean }, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;
  if (tok.type === TOKEN_RIGHT_CURLY) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
    return ok({ node, sawRest, done: true });
  }

  const commaResult = handleObjectTrailingComma(parserContext, tok, node, sawRest);
  if (isErr(commaResult)) { return commaResult; }
  if (!commaResult.value.continueLoop) {
    return ok({ node: commaResult.value.node, sawRest: commaResult.value.sawRest, done: true });
  }

  const spreadR = tryObjectSpreadTerminator(parserContext, commaResult.value.node, commaResult.value.sawRest);
  if (isErr(spreadR)) { return spreadR; }
  if (spreadR.value !== null) {
    return ok({ node: spreadR.value.node, sawRest: true, done: true });
  }

  const propR = parseObjectPatternProperty(parserContext, commaResult.value.node);
  if (isErr(propR)) { return propR; }
  return ok({ node: propR.value, sawRest: commaResult.value.sawRest, done: false });
};

const parseObjectPatternLoop = ({ parserContext, initialNode, initialSawRest }: { parserContext: ParserContext; initialNode: ChildrenNode; initialSawRest: boolean }): Result<{ node: ChildrenNode; sawRest: boolean }, TemplateError> => {
  const parseLoop = (
    node: ChildrenNode,
    sawRest: boolean
  ): Result<{ node: ChildrenNode; sawRest: boolean }, TemplateError> => {
    const iterR = parseObjectIteration({ parserContext, node, sawRest });
    if (isErr(iterR)) { return iterR; }
    if (iterR.value.done) {
      return ok({ node: iterR.value.node, sawRest: iterR.value.sawRest });
    }
    return parseLoop(iterR.value.node, iterR.value.sawRest);
  };

  return parseLoop(initialNode, initialSawRest);
};

const parseObjectPattern = (parserContext: ParserContext, origin: Loc): Result<Node, TemplateError> => {
  const node = objectPattern(origin);
  const startTokR = nextToken(parserContext);
  if (isErr(startTokR)) { return startTokR; }
  if (startTokR.value.type !== TOKEN_LEFT_CURLY) {
    return fail(parserContext, 'parseObjectPattern: expected {', { lineno: origin.lineno, colno: origin.colno });
  }

  const loopR = parseObjectPatternLoop({ parserContext, initialNode: node, initialSawRest: false });
  if (isErr(loopR)) { return loopR; }
  return ok(loopR.value.node);
};

export const parsePattern = (parserContext: ParserContext): Result<Node | null, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) { return tokR; }
  const tok = tokR.value;
  const origin = loc(tok);
  if (tok.type === TOKEN_LEFT_BRACKET) {
    return parseArrayPattern(parserContext, origin);
  }
  if (tok.type === TOKEN_LEFT_CURLY) {
    return parseObjectPattern(parserContext, origin);
  }
  return fail(parserContext, 'parsePattern: expected [ or {',
    { lineno: tok.lineno, colno: tok.colno });
};

export const tryParsePattern = (parserContext: ParserContext): Result<Node | null, TemplateError> => {
  if (isDestructuringStart(parserContext)) {
    return parsePattern(parserContext);
  }
  return ok(null);
};
