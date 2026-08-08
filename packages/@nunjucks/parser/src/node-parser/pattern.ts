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
import { nextToken, peekToken, skip, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";
import { loc } from '@nunjucks/shared';

const isDestructuringStart = (parserContext: ParserContext): boolean => {
  const tok = peekToken(parserContext);
  return Boolean(tok) && (tok.type === TOKEN_LEFT_BRACKET || tok.type === TOKEN_LEFT_CURLY);
};

const parseInnerPattern = (parserContext: ParserContext): Node => {
  if (isDestructuringStart(parserContext)) {
    const node = parsePattern(parserContext);
    if (node) {
      return node;
    }
  }
  const tok = peekToken(parserContext);
  if (tok?.type === TOKEN_SYMBOL) {
    const symbolTok = nextToken(parserContext);
    return symbol(loc(symbolTok), isSymbolToken(symbolTok) ? symbolTok.value : String(symbolTok.value));
  }
  return fail(parserContext, 'parseInnerPattern: expected symbol or pattern',
    tok?.lineno ?? 0, tok?.colno ?? 0);
};

const parseAssignmentDefault = (parserContext: ParserContext, target: Node): Node | null => {
  const peeked = peekToken(parserContext);
  if (peeked?.type === TOKEN_OPERATOR && peeked?.value === '=') {
    nextToken(parserContext);
    const defaultExpr = parseExpression(parserContext);
    return assignmentPattern(loc(target), target, defaultExpr);
  }
  return null;
};

const handleArrayElement = (
  parserContext: ParserContext,
  node: ChildrenNode,
  tok: Token,
  sawRest: boolean
): { node: ChildrenNode; sawRest: boolean } => {
  const elementType = peekToken(parserContext).type;

  if (elementType === TOKEN_SPREAD) {
    nextToken(parserContext);
    const inner = parseInnerPattern(parserContext);
    const rp = restPattern(loc(tok), inner);
    return { node: appendChild(node, rp), sawRest: true };
  }
  if (elementType === TOKEN_LEFT_BRACKET) {
    const innerTok = peekToken(parserContext);
    const inner = parseArrayPattern(parserContext, innerTok.lineno, innerTok.colno);
    const withDefault = parseAssignmentDefault(parserContext, inner);
    return { node: appendChild(node, withDefault ?? inner), sawRest };
  }
  if (elementType === TOKEN_LEFT_CURLY) {
    const innerTok = peekToken(parserContext);
    const inner = parseObjectPattern(parserContext, innerTok.lineno, innerTok.colno);
    const withDefault = parseAssignmentDefault(parserContext, inner);
    return { node: appendChild(node, withDefault ?? inner), sawRest };
  }
  const symTok = nextToken(parserContext);
  if (!symTok || symTok.type !== TOKEN_SYMBOL) {
    fail(parserContext, 'parseArrayPattern: expected symbol in pattern',
      symTok?.lineno ?? tok.lineno, symTok?.colno ?? tok.colno);
    return { node, sawRest };
  }
  const target = symbol(loc(symTok), symTok.value);
  const withDefault = parseAssignmentDefault(parserContext, target);
  return { node: appendChild(node, withDefault ?? target), sawRest };
};

const handleArrayTrailingComma = (
  parserContext: ParserContext,
  tok: Token,
  node: ChildrenNode,
  sawRest: boolean
): { node: ChildrenNode; sawRest: boolean; continueLoop: boolean } => {
  if ((node.children?.length ?? 0) > 0 && !sawRest) {
    if (!skip(parserContext, TOKEN_COMMA)) {
      fail(parserContext, 'parseArrayPattern: expected comma',
        tok.lineno,
        tok.colno);
    }
    const after = peekToken(parserContext);
    if (after?.type === TOKEN_RIGHT_BRACKET) {
      nextToken(parserContext);
      return { node, sawRest, continueLoop: false };
    }
    if (after?.type === TOKEN_COMMA) {
      return { node: appendChild(node, hole(loc(after))), sawRest, continueLoop: true };
    }
  }
  return { node, sawRest, continueLoop: true };
};

const parseArrayPattern = (parserContext: ParserContext, lineno: number, colno: number): Node => {
  let node = arrayPattern(loc({ lineno, colno }));
  const startTok = nextToken(parserContext);
  if (startTok.type !== TOKEN_LEFT_BRACKET) {
    fail(parserContext, 'parseArrayPattern: expected [', lineno, colno);
  }

  let sawRest = false;
  let skipTrailingCommaCheck = false;
  for (;;) {
    const tok = peekToken(parserContext);
    if (tok.type === TOKEN_RIGHT_BRACKET) {
      nextToken(parserContext);
      break;
    }

    if (skipTrailingCommaCheck) {
      skipTrailingCommaCheck = false;
    } else {
      const commaResult = handleArrayTrailingComma(parserContext, tok, node, sawRest);
      if (!commaResult.continueLoop) {
        break;
      }
      node = commaResult.node;
      sawRest = commaResult.sawRest;
    }

    const result = handleArrayElement(parserContext, node, tok, sawRest);
    node = result.node;
    sawRest = result.sawRest;
    const after = peekToken(parserContext);
    if (after?.type === TOKEN_COMMA) {
      nextToken(parserContext);
      skipTrailingCommaCheck = true;
    }
  }

  return node;
};

const parseObjectPropertyKey = (parserContext: ParserContext): { keyTok: Token; keyName: string } => {
  const keyTok = nextToken(parserContext);
  if (keyTok.type !== TOKEN_STRING && keyTok.type !== TOKEN_SYMBOL) {
    fail(parserContext, 'parseObjectPattern: expected property name',
      keyTok.lineno,
      keyTok.colno);
  }
  const keyName = keyTok.type === TOKEN_STRING ? String(keyTok.value) : (isSymbolToken(keyTok) ? keyTok.value : String(keyTok.value));
  return { keyTok, keyName };
};

const parseObjectPropertyValue = (parserContext: ParserContext, keyTok: Token, keyName: string): Node => {
  if (skip(parserContext, TOKEN_COLON)) {
    if (peekToken(parserContext).type === TOKEN_LEFT_BRACKET) {
      const bracketTok = peekToken(parserContext);
      return parseArrayPattern(parserContext, bracketTok.lineno, bracketTok.colno);
    }
    if (peekToken(parserContext).type === TOKEN_LEFT_CURLY) {
      const braceTok = peekToken(parserContext);
      return parseObjectPattern(parserContext, braceTok.lineno, braceTok.colno);
    }
    return parseInnerPattern(parserContext);
  }
  return symbol(loc(keyTok), keyName);
};

const handleObjectTrailingComma = (parserContext: ParserContext, tok: Token, node: ChildrenNode, sawRest: boolean): { node: ChildrenNode; sawRest: boolean; continueLoop: boolean } => {
  if ((node.children?.length ?? 0) > 0 && !sawRest) {
    if (!skip(parserContext, TOKEN_COMMA)) {
      fail(parserContext, 'parseObjectPattern: expected comma',
        tok.lineno,
        tok.colno);
    }
    const after = peekToken(parserContext);
    if (after?.type === TOKEN_RIGHT_CURLY) {
      nextToken(parserContext);
      return { node, sawRest, continueLoop: false };
    }
    if (after?.type === TOKEN_COMMA) {
      return { node: appendChild(node, hole(loc(after))), sawRest, continueLoop: true };
    }
  }
  return { node, sawRest, continueLoop: true };
};

const handleObjectSpread = (parserContext: ParserContext, node: ChildrenNode, sawRest: boolean): { node: ChildrenNode; sawRest: boolean } => {
  if (peekToken(parserContext).type === TOKEN_SPREAD) {
    nextToken(parserContext);
    const tok = peekToken(parserContext);
    const inner = parseInnerPattern(parserContext);
    return { node: appendChild(node, restPattern(loc(tok), inner)), sawRest: true };
  }
  return { node, sawRest };
};

const parseObjectPatternProperty = (parserContext: ParserContext, node: ChildrenNode): ChildrenNode => {
  const { keyTok, keyName } = parseObjectPropertyKey(parserContext);
  const valueTarget = parseObjectPropertyValue(parserContext, keyTok, keyName);
  const withDefault = parseAssignmentDefault(parserContext, valueTarget);
  return appendChild(node, patternProperty(
    loc(keyTok),
    symbol(loc(keyTok), keyName),
    withDefault ?? valueTarget
  ));
};

const parseObjectPatternLoop = (
  parserContext: ParserContext,
  initialNode: ChildrenNode,
  initialSawRest: boolean
): { node: ChildrenNode; sawRest: boolean } => {
  let node = initialNode;
  let sawRest = initialSawRest;

  for (;;) {
    const tok = peekToken(parserContext);
    if (tok.type === TOKEN_RIGHT_CURLY) {
      nextToken(parserContext);
      return { node, sawRest };
    }

    const commaResult = handleObjectTrailingComma(parserContext, tok, node, sawRest);
    if (!commaResult.continueLoop) {
      return { node: commaResult.node, sawRest: commaResult.sawRest };
    }

    const spreadResult = handleObjectSpread(parserContext, commaResult.node, commaResult.sawRest);
    if (spreadResult.sawRest) {
      const after = peekToken(parserContext);
      if (after?.type === TOKEN_COMMA) {
        nextToken(parserContext);
      }
      return { node: spreadResult.node, sawRest: true };
    }

    node = parseObjectPatternProperty(parserContext, spreadResult.node);
    sawRest = commaResult.sawRest;
  }
};

const parseObjectPattern = (parserContext: ParserContext, lineno: number, colno: number): Node => {
  const node = objectPattern(loc({ lineno, colno }));
  const startTok = nextToken(parserContext);
  if (startTok.type !== TOKEN_LEFT_CURLY) {
    fail(parserContext, 'parseObjectPattern: expected {', lineno, colno);
  }

  const loopResult = parseObjectPatternLoop(parserContext, node, false);
  return loopResult.node;
};

export const parsePattern = (parserContext: ParserContext): Node | null => {
  const tok = peekToken(parserContext);
  if (!tok) {
    fail(parserContext, 'parsePattern: unexpected end of input', 0, 0);
  }
  if (tok.type === TOKEN_LEFT_BRACKET) {
    return parseArrayPattern(parserContext, tok.lineno, tok.colno);
  }
  if (tok.type === TOKEN_LEFT_CURLY) {
    return parseObjectPattern(parserContext, tok.lineno, tok.colno);
  }
  fail(parserContext, 'parsePattern: expected [ or {',
    tok.lineno,
    tok.colno);
  return null;
};

export const tryParsePattern = (parserContext: ParserContext): Node | null => {
  if (isDestructuringStart(parserContext)) {
    return parsePattern(parserContext);
  }
  return null;
};
