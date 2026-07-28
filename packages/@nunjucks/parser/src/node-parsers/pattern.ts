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
} from '@nunjucks/lexer';
import { appendChild, arrayPattern, assignmentPattern, hole, objectPattern, patternProperty, restPattern, symbol } from '@nunjucks/nodes';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import { nextToken, peekToken, skip, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/inline.ts";

const isDestructuringStart = (ctx: ParserContext): boolean => {
  const tok = peekToken(ctx);
  return Boolean(tok) && (tok.type === TOKEN_LEFT_BRACKET || tok.type === TOKEN_LEFT_CURLY);
};

const parseInnerPattern = (ctx: ParserContext): Node => {
  if (isDestructuringStart(ctx)) {
    return parsePattern(ctx) as Node;
  }
  const tok = peekToken(ctx);
  if (tok && tok.type === TOKEN_SYMBOL) {
    const t = nextToken(ctx);
    return symbol(t.lineno, t.colno, t.value as string);
  }
  return fail(ctx, 'parseInnerPattern: expected symbol or pattern',
    tok?.lineno ?? 0, tok?.colno ?? 0);
};

const parseAssignmentDefault = (ctx: ParserContext, target: Node): Node | null => {
  const peeked = peekToken(ctx);
  if (peeked && peeked.type === TOKEN_OPERATOR && peeked.value === '=') {
    nextToken(ctx);
    const defaultExpr = parseExpression(ctx);
    return assignmentPattern(target.lineno, target.colno, target, defaultExpr);
  }
  return null;
};

const handleArrayElement = (
  ctx: ParserContext,
  node: Node,
  tok: ReturnType<typeof peekToken>,
  sawRest: boolean
): { node: Node; sawRest: boolean } => {
  const elementType = peekToken(ctx).type;

  if (elementType === TOKEN_SPREAD) {
    nextToken(ctx);
    const inner = parseInnerPattern(ctx);
    const rp = restPattern(tok.lineno, tok.colno, inner);
    return { node: appendChild(node as ChildrenNode, rp), sawRest: true };
  }
  if (elementType === TOKEN_LEFT_BRACKET) {
    const innerTok = peekToken(ctx);
    const inner = parseArrayPattern(ctx, innerTok.lineno, innerTok.colno);
    const withDefault = parseAssignmentDefault(ctx, inner);
    return { node: appendChild(node as ChildrenNode, withDefault ?? inner), sawRest };
  }
  if (elementType === TOKEN_LEFT_CURLY) {
    const innerTok = peekToken(ctx);
    const inner = parseObjectPattern(ctx, innerTok.lineno, innerTok.colno);
    const withDefault = parseAssignmentDefault(ctx, inner);
    return { node: appendChild(node as ChildrenNode, withDefault ?? inner), sawRest };
  }
  const symTok = nextToken(ctx);
  if (!symTok || symTok.type !== TOKEN_SYMBOL) {
    fail(ctx, 'parseArrayPattern: expected symbol in pattern',
      symTok?.lineno ?? tok.lineno, symTok?.colno ?? tok.colno);
    return { node, sawRest };
  }
  const target = symbol(symTok.lineno, symTok.colno, symTok.value as string);
  const withDefault = parseAssignmentDefault(ctx, target);
  return { node: appendChild(node as ChildrenNode, withDefault ?? target), sawRest };
};

const handleArrayTrailingComma = (
  ctx: ParserContext,
  tok: ReturnType<typeof peekToken>,
  node: Node,
  sawRest: boolean
): { node: Node; sawRest: boolean; continueLoop: boolean } => {
  if ((node.children?.length ?? 0) > 0 && !sawRest) {
    if (!skip(ctx, TOKEN_COMMA)) {
      fail(ctx, 'parseArrayPattern: expected comma',
        tok.lineno,
        tok.colno);
    }
    const after = peekToken(ctx);
    if (after && after.type === TOKEN_RIGHT_BRACKET) {
      nextToken(ctx);
      return { node, sawRest, continueLoop: false };
    }
    if (after && after.type === TOKEN_COMMA) {
      return { node: appendChild(node as ChildrenNode, hole(after.lineno, after.colno)), sawRest, continueLoop: true };
    }
  }
  return { node, sawRest, continueLoop: true };
};

const parseArrayPattern = (ctx: ParserContext, lineno: number, colno: number): Node => {
  let node = arrayPattern(lineno, colno);
  const startTok = nextToken(ctx);
  if (startTok.type !== TOKEN_LEFT_BRACKET) {
    fail(ctx, 'parseArrayPattern: expected [', lineno, colno);
  }

  let sawRest = false;
  let skipTrailingCommaCheck = false;
  for (;;) {
    const tok = peekToken(ctx);
    if (tok.type === TOKEN_RIGHT_BRACKET) {
      nextToken(ctx);
      break;
    }

    if (skipTrailingCommaCheck) {
      skipTrailingCommaCheck = false;
    } else {
      const commaResult = handleArrayTrailingComma(ctx, tok, node, sawRest);
      if (!commaResult.continueLoop) {
        break;
      }
      node = commaResult.node as ChildrenNode;
      sawRest = commaResult.sawRest;
    }

    const result = handleArrayElement(ctx, node, tok, sawRest);
    node = result.node as ChildrenNode;
    sawRest = result.sawRest;
    const after = peekToken(ctx);
    if (after && after.type === TOKEN_COMMA) {
      nextToken(ctx);
      skipTrailingCommaCheck = true;
    }
  }

  return node;
};

const parseObjectPropertyKey = (ctx: ParserContext): { keyTok: Token; keyName: string | null } => {
  const keyTok = nextToken(ctx);
  let keyName: string | null = null;
  if (keyTok.type === TOKEN_STRING) {
    keyName = String(keyTok.value);
  } else if (keyTok.type === TOKEN_SYMBOL) {
    keyName = keyTok.value as string;
  } else {
    fail(ctx, 'parseObjectPattern: expected property name',
      keyTok.lineno,
      keyTok.colno);
  }
  return { keyTok, keyName };
};

const parseObjectPropertyValue = (ctx: ParserContext, keyTok: Token, keyName: string): Node => {
  if (skip(ctx, TOKEN_COLON)) {
    if (peekToken(ctx).type === TOKEN_LEFT_BRACKET) {
      const t = peekToken(ctx);
      return parseArrayPattern(ctx, t.lineno, t.colno);
    }
    if (peekToken(ctx).type === TOKEN_LEFT_CURLY) {
      const t = peekToken(ctx);
      return parseObjectPattern(ctx, t.lineno, t.colno);
    }
    return parseInnerPattern(ctx);
  }
  return symbol(keyTok.lineno, keyTok.colno, keyName);
};

const handleObjectTrailingComma = (ctx: ParserContext, tok: Token, node: Node, sawRest: boolean): { node: Node; sawRest: boolean; continueLoop: boolean } => {
  if ((node.children?.length ?? 0) > 0 && !sawRest) {
    if (!skip(ctx, TOKEN_COMMA)) {
      fail(ctx, 'parseObjectPattern: expected comma',
        tok.lineno,
        tok.colno);
    }
    const after = peekToken(ctx);
    if (after && after.type === TOKEN_RIGHT_CURLY) {
      nextToken(ctx);
      return { node, sawRest, continueLoop: false };
    }
    if (after && after.type === TOKEN_COMMA) {
      return { node: appendChild(node as ChildrenNode, hole(after.lineno, after.colno)), sawRest, continueLoop: true };
    }
  }
  return { node, sawRest, continueLoop: true };
};

const handleObjectSpread = (ctx: ParserContext, node: Node, sawRest: boolean): { node: Node; sawRest: boolean } => {
  if (peekToken(ctx).type === TOKEN_SPREAD) {
    nextToken(ctx);
    const tok = peekToken(ctx);
    const inner = parseInnerPattern(ctx);
    return { node: appendChild(node as ChildrenNode, restPattern(tok.lineno, tok.colno, inner)), sawRest: true };
  }
  return { node, sawRest };
};

const parseObjectPatternProperty = (ctx: ParserContext, node: Node): Node => {
  const { keyTok, keyName } = parseObjectPropertyKey(ctx);
  const valueTarget = parseObjectPropertyValue(ctx, keyTok, keyName as string);
  const withDefault = parseAssignmentDefault(ctx, valueTarget);
  return appendChild(node as ChildrenNode, patternProperty(
    keyTok.lineno,
    keyTok.colno,
    symbol(keyTok.lineno, keyTok.colno, keyName ?? ''),
    withDefault ?? valueTarget
  ));
};

const parseObjectPatternLoop = (
  ctx: ParserContext,
  initialNode: Node,
  initialSawRest: boolean
): { node: Node; sawRest: boolean } => {
  let node = initialNode;
  let sawRest = initialSawRest;

  for (;;) {
    const tok = peekToken(ctx);
    if (tok.type === TOKEN_RIGHT_CURLY) {
      nextToken(ctx);
      return { node, sawRest };
    }

    const commaResult = handleObjectTrailingComma(ctx, tok, node, sawRest);
    if (!commaResult.continueLoop) {
      return { node: commaResult.node, sawRest: commaResult.sawRest };
    }

    const spreadResult = handleObjectSpread(ctx, commaResult.node, commaResult.sawRest);
    if (spreadResult.sawRest) {
      const after = peekToken(ctx);
      if (after?.type === TOKEN_COMMA) {
        nextToken(ctx);
      }
      return { node: spreadResult.node, sawRest: true };
    }

    node = parseObjectPatternProperty(ctx, spreadResult.node);
    sawRest = commaResult.sawRest;
  }
};

const parseObjectPattern = (ctx: ParserContext, lineno: number, colno: number): Node => {
  const node = objectPattern(lineno, colno);
  const startTok = nextToken(ctx);
  if (startTok.type !== TOKEN_LEFT_CURLY) {
    fail(ctx, 'parseObjectPattern: expected {', lineno, colno);
  }

  const loopResult = parseObjectPatternLoop(ctx, node, false);
  return loopResult.node;
};

export const parsePattern = (ctx: ParserContext): Node | null => {
  const tok = peekToken(ctx);
  if (!tok) {
    fail(ctx, 'parsePattern: unexpected end of input', 0, 0);
  }
  if (tok.type === TOKEN_LEFT_BRACKET) {
    return parseArrayPattern(ctx, tok.lineno, tok.colno);
  }
  if (tok.type === TOKEN_LEFT_CURLY) {
    return parseObjectPattern(ctx, tok.lineno, tok.colno);
  }
  fail(ctx, 'parsePattern: expected [ or {',
    tok.lineno,
    tok.colno);
  return null;
};

export const tryParsePattern = (ctx: ParserContext): Node | null => {
  if (isDestructuringStart(ctx)) {
    return parsePattern(ctx);
  }
  return null;
};
