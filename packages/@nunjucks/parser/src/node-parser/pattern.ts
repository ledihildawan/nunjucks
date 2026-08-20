// biome-ignore lint/style/noExcessiveLinesPerFile: Result unwrap boilerplate inflates line count
import type { TemplateError } from '@nunjucks/error-formatter';
import {
  isSymbolToken,
  TOKEN_COLON,
  TOKEN_COMMA,
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_CURLY,
  TOKEN_OPERATOR,
  TOKEN_RIGHT_BRACKET,
  TOKEN_RIGHT_CURLY,
  TOKEN_SPREAD,
  TOKEN_STRING,
  TOKEN_SYMBOL,
  type Token,
} from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import {
  appendChild,
  arrayPattern,
  assignmentPattern,
  hole,
  objectPattern,
  patternProperty,
  restPattern,
  symbol,
} from '@nunjucks/nodes';
import { type Loc, loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { fail, nextToken, peekToken, peekTokenOrNull, skip } from '../cursor.ts';
import { parseExpression } from '../expression-parser/index.ts';

const isDestructuringStart = (parserContext: ParserContext): boolean => {
  const tok = peekTokenOrNull(parserContext);
  return tok !== null && (tok.type === TOKEN_LEFT_BRACKET || tok.type === TOKEN_LEFT_CURLY);
};

const parseInnerPattern = (parserContext: ParserContext): Result<Node, TemplateError> => {
  if (isDestructuringStart(parserContext)) {
    const nodeR = parsePattern(parserContext);
    if (isErr(nodeR)) {
      return nodeR;
    }
    if (nodeR.value) {
      return ok(nodeR.value);
    }
  }
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;
  if (tok?.type === TOKEN_SYMBOL) {
    const symbolTokR = nextToken(parserContext);
    if (isErr(symbolTokR)) {
      return symbolTokR;
    }
    const symbolTok = symbolTokR.value;
    return ok(
      symbol(loc(symbolTok), isSymbolToken(symbolTok) ? symbolTok.value : String(symbolTok.value))
    );
  }
  return fail(parserContext, {
    message: 'parseInnerPattern: expected symbol or pattern',
    lineno: tok?.lineno ?? 0,
    colno: tok?.colno ?? 0,
  });
};

const parseAssignmentDefault = (
  parserContext: ParserContext,
  target: Node
): Result<Node | null, TemplateError> => {
  const peeked = peekTokenOrNull(parserContext);
  if (peeked?.type === TOKEN_OPERATOR && peeked?.value === '=') {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
    const defaultExprR = parseExpression(parserContext);
    if (isErr(defaultExprR)) {
      return defaultExprR;
    }
    return ok(assignmentPattern(loc(target), { target, defaultVal: defaultExprR.value }));
  }
  return ok(null);
};

const parseArrayRestElement = (
  parserContext: ParserContext,
  node: ChildrenNode,
  tok: Token
): Result<{ node: ChildrenNode; sawRest: boolean }, TemplateError> => {
  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) {
    return consumedR;
  }
  const innerR = parseInnerPattern(parserContext);
  if (isErr(innerR)) {
    return innerR;
  }
  const restPatternNode = restPattern(loc(tok), innerR.value);
  return ok({ node: appendChild(node, restPatternNode), sawRest: true });
};

const parseNestedPatternElement = (
  parserContext: ParserContext,
  peeked: Token
): Result<Node, TemplateError> => {
  const origin = loc(peeked);
  if (peeked.type === TOKEN_LEFT_BRACKET) {
    return parseArrayPattern(parserContext, origin);
  }
  return parseObjectPattern(parserContext, origin);
};

const parseArrayNestedElement = ({
  parserContext,
  node,
  peeked,
  sawRest,
}: {
  parserContext: ParserContext;
  node: ChildrenNode;
  peeked: Token;
  sawRest: boolean;
}): Result<{ node: ChildrenNode; sawRest: boolean }, TemplateError> => {
  const innerR = parseNestedPatternElement(parserContext, peeked);
  if (isErr(innerR)) {
    return innerR;
  }
  const withDefaultR = parseAssignmentDefault(parserContext, innerR.value);
  if (isErr(withDefaultR)) {
    return withDefaultR;
  }
  return ok({ node: appendChild(node, withDefaultR.value ?? innerR.value), sawRest });
};

const parseArraySymbolElement = ({
  parserContext,
  node,
  tok,
  sawRest,
}: {
  parserContext: ParserContext;
  node: ChildrenNode;
  tok: Token;
  sawRest: boolean;
}): Result<{ node: ChildrenNode; sawRest: boolean }, TemplateError> => {
  const symTokR = nextToken(parserContext);
  if (isErr(symTokR)) {
    return symTokR;
  }
  const symTok = symTokR.value;
  if (!symTok || symTok.type !== TOKEN_SYMBOL) {
    return fail(parserContext, {
      message: 'parseArrayPattern: expected symbol in pattern',
      lineno: symTok?.lineno ?? tok.lineno,
      colno: symTok?.colno ?? tok.colno,
    });
  }
  const target = symbol(loc(symTok), symTok.value);
  const withDefaultR = parseAssignmentDefault(parserContext, target);
  if (isErr(withDefaultR)) {
    return withDefaultR;
  }
  return ok({ node: appendChild(node, withDefaultR.value ?? target), sawRest });
};

const handleArrayElement = ({
  parserContext,
  node,
  tok,
  sawRest,
}: {
  parserContext: ParserContext;
  node: ChildrenNode;
  tok: Token;
  sawRest: boolean;
}): Result<{ node: ChildrenNode; sawRest: boolean }, TemplateError> => {
  const peekedR = peekToken(parserContext);
  if (isErr(peekedR)) {
    return peekedR;
  }
  const peeked = peekedR.value;

  if (peeked.type === TOKEN_SPREAD) {
    return parseArrayRestElement(parserContext, node, tok);
  }
  if (peeked.type === TOKEN_LEFT_BRACKET || peeked.type === TOKEN_LEFT_CURLY) {
    return parseArrayNestedElement({ parserContext, node, peeked, sawRest });
  }
  return parseArraySymbolElement({ parserContext, node, tok, sawRest });
};

interface TrailingCommaInput {
  terminationToken: Token['type'];
  label: string;
  parserContext: ParserContext;
  tok: Token;
  node: ChildrenNode;
  sawRest: boolean;
}

const handleTrailingComma = ({
  terminationToken,
  label,
  parserContext,
  tok,
  node,
  sawRest,
}: TrailingCommaInput): Result<
  { node: ChildrenNode; sawRest: boolean; continueLoop: boolean },
  TemplateError
> => {
  if ((node.children?.length ?? 0) > 0 && !sawRest) {
    if (!skip(parserContext, TOKEN_COMMA)) {
      return fail(parserContext, {
        message: `${label}: expected comma`,
        lineno: tok.lineno,
        colno: tok.colno,
      });
    }
    const afterR = peekToken(parserContext);
    if (isErr(afterR)) {
      return afterR;
    }
    const after = afterR.value;
    if (after.type === terminationToken) {
      const consumedR = nextToken(parserContext);
      if (isErr(consumedR)) {
        return consumedR;
      }
      return ok({ node, sawRest, continueLoop: false });
    }
  }
  return ok({ node, sawRest, continueLoop: true });
};

const consumeComma = (parserContext: ParserContext): Result<boolean, TemplateError> => {
  if (peekTokenOrNull(parserContext)?.type !== TOKEN_COMMA) {
    return ok(false);
  }
  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) {
    return consumedR;
  }
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
}): Result<
  { node: ChildrenNode; sawRest: boolean; skipCommaNext: boolean; done: boolean },
  TemplateError
> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;
  if (tok.type === TOKEN_RIGHT_BRACKET) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
    return ok({ node: initialNode, sawRest: initialSawRest, skipCommaNext: false, done: true });
  }

  let node = initialNode;
  let sawRest = initialSawRest;
  // WHY: right after a consumed separator, another comma is an ELIDED element (hole),
  // mirroring the aggregate list parser's `prepareAfterComma` — `{% for [a, , b] in x %}`
  // and `{% when [a, , b] %}` previously failed with "expected symbol in pattern".
  if (skipTrailingCommaCheck && tok.type === TOKEN_COMMA) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
    return ok({
      node: appendChild(node, hole(loc(tok))),
      sawRest,
      skipCommaNext: true,
      done: false,
    });
  }
  if (!skipTrailingCommaCheck) {
    const commaResult = handleTrailingComma({
      terminationToken: TOKEN_RIGHT_BRACKET,
      label: 'parseArrayPattern',
      parserContext,
      tok,
      node,
      sawRest,
    });
    if (isErr(commaResult)) {
      return commaResult;
    }
    if (!commaResult.value.continueLoop) {
      return ok({
        node: commaResult.value.node,
        sawRest: commaResult.value.sawRest,
        skipCommaNext: false,
        done: true,
      });
    }
    node = commaResult.value.node;
    sawRest = commaResult.value.sawRest;
  }

  const result = handleArrayElement({ parserContext, node, tok, sawRest });
  if (isErr(result)) {
    return result;
  }
  node = result.value.node;
  sawRest = result.value.sawRest;

  const consumedCommaR = consumeComma(parserContext);
  if (isErr(consumedCommaR)) {
    return consumedCommaR;
  }
  return ok({ node, sawRest, skipCommaNext: consumedCommaR.value, done: false });
};

const parseArrayPattern = (
  parserContext: ParserContext,
  origin: Loc
): Result<Node, TemplateError> => {
  const node = arrayPattern(origin);
  const startTokR = nextToken(parserContext);
  if (isErr(startTokR)) {
    return startTokR;
  }
  if (startTokR.value.type !== TOKEN_LEFT_BRACKET) {
    return fail(parserContext, {
      message: 'parseArrayPattern: expected [',
      lineno: origin.lineno,
      colno: origin.colno,
    });
  }

  interface ArrayPatternLoopState {
    current: ChildrenNode;
    sawRest: boolean;
    skipTrailingCommaCheck: boolean;
  }

  const parseLoop = ({
    current,
    sawRest,
    skipTrailingCommaCheck,
  }: ArrayPatternLoopState): Result<Node, TemplateError> => {
    const iterR = parseArrayIteration({
      parserContext,
      initialNode: current,
      initialSawRest: sawRest,
      skipTrailingCommaCheck,
    });
    if (isErr(iterR)) {
      return iterR;
    }
    if (iterR.value.done) {
      return ok(iterR.value.node);
    }
    return parseLoop({
      current: iterR.value.node,
      sawRest: iterR.value.sawRest,
      skipTrailingCommaCheck: iterR.value.skipCommaNext,
    });
  };

  return parseLoop({ current: node, sawRest: false, skipTrailingCommaCheck: false });
};

const parseObjectPropertyKey = (
  parserContext: ParserContext
): Result<{ keyTok: Token; keyName: string }, TemplateError> => {
  const keyTokR = nextToken(parserContext);
  if (isErr(keyTokR)) {
    return keyTokR;
  }
  const keyTok = keyTokR.value;
  if (keyTok.type !== TOKEN_STRING && keyTok.type !== TOKEN_SYMBOL) {
    return fail(parserContext, {
      message: 'parseObjectPattern: expected property name',
      lineno: keyTok.lineno,
      colno: keyTok.colno,
    });
  }
  const keyName = String(keyTok.value);
  return ok({ keyTok, keyName });
};

const parseObjectPropertyValue = (
  parserContext: ParserContext,
  keyTok: Token,
  keyName: string
): Result<Node, TemplateError> => {
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

const handleObjectSpread = (
  parserContext: ParserContext,
  node: ChildrenNode,
  sawRest: boolean
): Result<{ node: ChildrenNode; sawRest: boolean }, TemplateError> => {
  if (peekTokenOrNull(parserContext)?.type === TOKEN_SPREAD) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
    const tokR = peekToken(parserContext);
    if (isErr(tokR)) {
      return tokR;
    }
    const tok = tokR.value;
    const innerR = parseInnerPattern(parserContext);
    if (isErr(innerR)) {
      return innerR;
    }
    return ok({ node: appendChild(node, restPattern(loc(tok), innerR.value)), sawRest: true });
  }
  return ok({ node, sawRest });
};

const parseObjectPatternProperty = (
  parserContext: ParserContext,
  node: ChildrenNode
): Result<ChildrenNode, TemplateError> => {
  const keyR = parseObjectPropertyKey(parserContext);
  if (isErr(keyR)) {
    return keyR;
  }
  const { keyTok, keyName } = keyR.value;
  const valueTargetR = parseObjectPropertyValue(parserContext, keyTok, keyName);
  if (isErr(valueTargetR)) {
    return valueTargetR;
  }
  const valueTarget = valueTargetR.value;
  const withDefaultR = parseAssignmentDefault(parserContext, valueTarget);
  if (isErr(withDefaultR)) {
    return withDefaultR;
  }
  return ok(
    appendChild(
      node,
      patternProperty(loc(keyTok), {
        key: symbol(loc(keyTok), keyName),
        val: withDefaultR.value ?? valueTarget,
      })
    )
  );
};

const tryObjectSpreadTerminator = (
  parserContext: ParserContext,
  node: ChildrenNode,
  sawRest: boolean
): Result<{ node: ChildrenNode } | null, TemplateError> => {
  const spreadResult = handleObjectSpread(parserContext, node, sawRest);
  if (isErr(spreadResult)) {
    return spreadResult;
  }
  if (!spreadResult.value.sawRest) {
    return ok(null);
  }
  const commaR = consumeComma(parserContext);
  if (isErr(commaR)) {
    return commaR;
  }
  return ok({ node: spreadResult.value.node });
};

const parseObjectIteration = ({
  parserContext,
  node,
  sawRest,
}: {
  parserContext: ParserContext;
  node: ChildrenNode;
  sawRest: boolean;
}): Result<{ node: ChildrenNode; sawRest: boolean; done: boolean }, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;
  if (tok.type === TOKEN_RIGHT_CURLY) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
    return ok({ node, sawRest, done: true });
  }

  const commaResult = handleTrailingComma({
    terminationToken: TOKEN_RIGHT_CURLY,
    label: 'parseObjectPattern',
    parserContext,
    tok,
    node,
    sawRest,
  });
  if (isErr(commaResult)) {
    return commaResult;
  }
  if (!commaResult.value.continueLoop) {
    return ok({ node: commaResult.value.node, sawRest: commaResult.value.sawRest, done: true });
  }

  const spreadR = tryObjectSpreadTerminator(
    parserContext,
    commaResult.value.node,
    commaResult.value.sawRest
  );
  if (isErr(spreadR)) {
    return spreadR;
  }
  if (spreadR.value !== null) {
    return ok({ node: spreadR.value.node, sawRest: true, done: true });
  }

  const propR = parseObjectPatternProperty(parserContext, commaResult.value.node);
  if (isErr(propR)) {
    return propR;
  }
  return ok({ node: propR.value, sawRest: commaResult.value.sawRest, done: false });
};

const parseObjectPatternLoop = ({
  parserContext,
  initialNode,
  initialSawRest,
}: {
  parserContext: ParserContext;
  initialNode: ChildrenNode;
  initialSawRest: boolean;
}): Result<{ node: ChildrenNode; sawRest: boolean }, TemplateError> => {
  const parseLoop = (
    node: ChildrenNode,
    sawRest: boolean
  ): Result<{ node: ChildrenNode; sawRest: boolean }, TemplateError> => {
    const iterR = parseObjectIteration({ parserContext, node, sawRest });
    if (isErr(iterR)) {
      return iterR;
    }
    if (iterR.value.done) {
      return ok({ node: iterR.value.node, sawRest: iterR.value.sawRest });
    }
    return parseLoop(iterR.value.node, iterR.value.sawRest);
  };

  return parseLoop(initialNode, initialSawRest);
};

const parseObjectPattern = (
  parserContext: ParserContext,
  origin: Loc
): Result<Node, TemplateError> => {
  const node = objectPattern(origin);
  const startTokR = nextToken(parserContext);
  if (isErr(startTokR)) {
    return startTokR;
  }
  if (startTokR.value.type !== TOKEN_LEFT_CURLY) {
    return fail(parserContext, {
      message: 'parseObjectPattern: expected {',
      lineno: origin.lineno,
      colno: origin.colno,
    });
  }

  const loopR = parseObjectPatternLoop({ parserContext, initialNode: node, initialSawRest: false });
  if (isErr(loopR)) {
    return loopR;
  }
  return ok(loopR.value.node);
};

/** Parses an array or object destructuring pattern, failing on other tokens. */
export const parsePattern = (parserContext: ParserContext): Result<Node | null, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;
  const origin = loc(tok);
  if (tok.type === TOKEN_LEFT_BRACKET) {
    return parseArrayPattern(parserContext, origin);
  }
  if (tok.type === TOKEN_LEFT_CURLY) {
    return parseObjectPattern(parserContext, origin);
  }
  return fail(parserContext, {
    message: 'parsePattern: expected [ or {',
    lineno: tok.lineno,
    colno: tok.colno,
  });
};

/** Parses a pattern when `[` or `{` is next; returns `null` without consuming otherwise. */
export const tryParsePattern = (
  parserContext: ParserContext
): Result<Node | null, TemplateError> => {
  if (isDestructuringStart(parserContext)) {
    return parsePattern(parserContext);
  }
  return ok(null);
};
