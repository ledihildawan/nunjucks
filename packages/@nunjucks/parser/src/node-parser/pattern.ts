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
import type { Node } from '@nunjucks/nodes';
import {
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
  tok: Token
): Result<Node, TemplateError> => {
  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) {
    return consumedR;
  }
  const innerR = parseInnerPattern(parserContext);
  if (isErr(innerR)) {
    return innerR;
  }
  return ok(restPattern(loc(tok), innerR.value));
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
  peeked,
}: {
  parserContext: ParserContext;
  peeked: Token;
}): Result<Node, TemplateError> => {
  const innerR = parseNestedPatternElement(parserContext, peeked);
  if (isErr(innerR)) {
    return innerR;
  }
  const withDefaultR = parseAssignmentDefault(parserContext, innerR.value);
  if (isErr(withDefaultR)) {
    return withDefaultR;
  }
  return ok(withDefaultR.value ?? innerR.value);
};

const parseArraySymbolElement = ({
  parserContext,
  tok,
}: {
  parserContext: ParserContext;
  tok: Token;
}): Result<Node, TemplateError> => {
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
  return ok(withDefaultR.value ?? target);
};

const handleArrayElement = ({
  parserContext,
  tok,
  sawRest,
}: {
  parserContext: ParserContext;
  tok: Token;
  sawRest: boolean;
}): Result<{ child: Node; sawRest: boolean }, TemplateError> => {
  const peekedR = peekToken(parserContext);
  if (isErr(peekedR)) {
    return peekedR;
  }
  const peeked = peekedR.value;

  if (peeked.type === TOKEN_SPREAD) {
    const childR = parseArrayRestElement(parserContext, tok);
    if (isErr(childR)) {
      return childR;
    }
    return ok({ child: childR.value, sawRest: true });
  }
  if (peeked.type === TOKEN_LEFT_BRACKET || peeked.type === TOKEN_LEFT_CURLY) {
    const childR = parseArrayNestedElement({ parserContext, peeked });
    if (isErr(childR)) {
      return childR;
    }
    return ok({ child: childR.value, sawRest });
  }
  const childR = parseArraySymbolElement({ parserContext, tok });
  if (isErr(childR)) {
    return childR;
  }
  return ok({ child: childR.value, sawRest });
};

interface TrailingCommaInput {
  terminationToken: Token['type'];
  label: string;
  parserContext: ParserContext;
  tok: Token;
  hasItems: boolean;
  sawRest: boolean;
}

const handleTrailingComma = ({
  terminationToken,
  label,
  parserContext,
  tok,
  hasItems,
  sawRest,
}: TrailingCommaInput): Result<{ sawRest: boolean; continueLoop: boolean }, TemplateError> => {
  if (hasItems && !sawRest) {
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
      return ok({ sawRest, continueLoop: false });
    }
  }
  return ok({ sawRest, continueLoop: true });
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

interface ArrayIterationResult {
  sawRest: boolean;
  skipCommaNext: boolean;
  done: boolean;
}

// WHY: `...rest` must be the final element — only a trailing comma then `]` may follow,
// so post-rest junk like `[a, ...r b]` fails here instead of parsing as another element
// (comma validation is otherwise skipped entirely after rest).
const parsePostRestClose = (
  parserContext: ParserContext,
  tok: Token
): Result<ArrayIterationResult, TemplateError> => {
  if (skip(parserContext, TOKEN_COMMA)) {
    const closeR = nextToken(parserContext);
    if (isErr(closeR)) {
      return closeR;
    }
    if (closeR.value.type !== TOKEN_RIGHT_BRACKET) {
      return fail(parserContext, {
        message: 'parseArrayPattern: rest must be the last element',
        lineno: closeR.value.lineno,
        colno: closeR.value.colno,
      });
    }
    return ok({ sawRest: true, skipCommaNext: false, done: true });
  }
  return fail(parserContext, {
    message: 'parseArrayPattern: rest must be the last element',
    lineno: tok.lineno,
    colno: tok.colno,
  });
};

const closeArrayPattern = (
  parserContext: ParserContext,
  sawRest: boolean
): Result<ArrayIterationResult, TemplateError> => {
  const consumedR = nextToken(parserContext);
  if (isErr(consumedR)) {
    return consumedR;
  }
  return ok({ sawRest, skipCommaNext: false, done: true });
};

const parseArrayIteration = ({
  parserContext,
  children,
  sawRest: initialSawRest,
  skipTrailingCommaCheck,
}: {
  parserContext: ParserContext;
  children: Node[];
  sawRest: boolean;
  skipTrailingCommaCheck: boolean;
}): Result<ArrayIterationResult, TemplateError> => {
  const tokR = peekToken(parserContext);
  if (isErr(tokR)) {
    return tokR;
  }
  const tok = tokR.value;
  if (tok.type === TOKEN_RIGHT_BRACKET) {
    return closeArrayPattern(parserContext, initialSawRest);
  }

  if (initialSawRest) {
    return parsePostRestClose(parserContext, tok);
  }

  let sawRest: boolean = initialSawRest;
  // WHY: right after a consumed separator, another comma is an ELIDED element (hole),
  // mirroring the aggregate list parser's `prepareAfterComma` — `{% for [a, , b] in x %}`
  // and `{% when [a, , b] %}` previously failed with "expected symbol in pattern".
  if (skipTrailingCommaCheck && tok.type === TOKEN_COMMA) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
    children.push(hole(loc(tok)));
    return ok({ sawRest, skipCommaNext: true, done: false });
  }
  if (!skipTrailingCommaCheck) {
    const commaResult = handleTrailingComma({
      terminationToken: TOKEN_RIGHT_BRACKET,
      label: 'parseArrayPattern',
      parserContext,
      tok,
      hasItems: children.length > 0,
      sawRest,
    });
    if (isErr(commaResult)) {
      return commaResult;
    }
    if (!commaResult.value.continueLoop) {
      return ok({
        sawRest: commaResult.value.sawRest,
        skipCommaNext: false,
        done: true,
      });
    }
    sawRest = commaResult.value.sawRest;
  }

  const result = handleArrayElement({ parserContext, tok, sawRest });
  if (isErr(result)) {
    return result;
  }
  children.push(result.value.child);
  sawRest = result.value.sawRest;

  const consumedCommaR = consumeComma(parserContext);
  if (isErr(consumedCommaR)) {
    return consumedCommaR;
  }
  return ok({ sawRest, skipCommaNext: consumedCommaR.value, done: false });
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

  // WHY: iterative loop with a local accumulator (parser loop exemption) — the recursive
  // parseLoop recursed once per pattern element and threaded each one through the
  // copying appendChild (O(n²)), so `[a,a,a,...]` destructuring targets overflowed
  // the stack and crawled on element-count-long patterns.
  const children: Node[] = [];
  let sawRest = false;
  let skipTrailingCommaCheck = false;
  while (true) {
    const iterR = parseArrayIteration({
      parserContext,
      children,
      sawRest,
      skipTrailingCommaCheck,
    });
    if (isErr(iterR)) {
      return iterR;
    }
    if (iterR.value.done) {
      return ok({ ...node, children });
    }
    sawRest = iterR.value.sawRest;
    skipTrailingCommaCheck = iterR.value.skipCommaNext;
  }
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
  children: Node[],
  sawRest: boolean
): Result<{ sawRest: boolean }, TemplateError> => {
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
    children.push(restPattern(loc(tok), innerR.value));
    return ok({ sawRest: true });
  }
  return ok({ sawRest });
};

const parseObjectPatternProperty = (parserContext: ParserContext): Result<Node, TemplateError> => {
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
    patternProperty(loc(keyTok), {
      key: symbol(loc(keyTok), keyName),
      val: withDefaultR.value ?? valueTarget,
    })
  );
};

const tryObjectSpreadTerminator = (
  parserContext: ParserContext,
  children: Node[],
  sawRest: boolean
): Result<true | null, TemplateError> => {
  const spreadResult = handleObjectSpread(parserContext, children, sawRest);
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
  return ok(true);
};

const parseObjectIteration = ({
  parserContext,
  children,
  sawRest,
}: {
  parserContext: ParserContext;
  children: Node[];
  sawRest: boolean;
}): Result<{ sawRest: boolean; done: boolean }, TemplateError> => {
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
    return ok({ sawRest, done: true });
  }

  const commaResult = handleTrailingComma({
    terminationToken: TOKEN_RIGHT_CURLY,
    label: 'parseObjectPattern',
    parserContext,
    tok,
    hasItems: children.length > 0,
    sawRest,
  });
  if (isErr(commaResult)) {
    return commaResult;
  }
  if (!commaResult.value.continueLoop) {
    return ok({ sawRest: commaResult.value.sawRest, done: true });
  }

  const spreadR = tryObjectSpreadTerminator(parserContext, children, commaResult.value.sawRest);
  if (isErr(spreadR)) {
    return spreadR;
  }
  if (spreadR.value !== null) {
    return ok({ sawRest: true, done: true });
  }

  const propR = parseObjectPatternProperty(parserContext);
  if (isErr(propR)) {
    return propR;
  }
  children.push(propR.value);
  return ok({ sawRest: commaResult.value.sawRest, done: false });
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

  // WHY: iterative loop with a local accumulator (parser loop exemption) — the recursive
  // parseLoop recursed once per property and threaded each one through the copying
  // appendChild (O(n²)), so `{a: b,a: b,...}` destructuring targets overflowed the
  // stack and crawled on property-count-long patterns.
  const children: Node[] = [];
  let sawRest = false;
  while (true) {
    const iterR = parseObjectIteration({ parserContext, children, sawRest });
    if (isErr(iterR)) {
      return iterR;
    }
    sawRest = iterR.value.sawRest;
    if (iterR.value.done) {
      return ok({ ...node, children });
    }
  }
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
