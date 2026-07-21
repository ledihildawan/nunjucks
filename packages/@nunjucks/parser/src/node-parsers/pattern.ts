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
} from '@nunjucks/lexer';
import { nodes } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { nextToken, peekToken, skip, fail } from "../cursor.ts";
import type { ParserContext, MutableNode } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";

const isDestructuringStart = (ctx: ParserContext): boolean => {
  const tok = peekToken(ctx);
  return !!tok && (tok.type === TOKEN_LEFT_BRACKET || tok.type === TOKEN_LEFT_CURLY);
};

const parseInnerPattern = (ctx: ParserContext): Node => {
  if (isDestructuringStart(ctx)) {
    return parsePattern(ctx) as Node;
  }
  const tok = peekToken(ctx);
  if (tok && tok.type === TOKEN_SYMBOL) {
    const t = nextToken(ctx);
    return nodes.symbol(t.lineno, t.colno, t.value as string);
  }
  return fail(ctx, 'parseInnerPattern: expected symbol or pattern',
    tok?.lineno ?? 0, tok?.colno ?? 0);
};

const parseAssignmentDefault = (ctx: ParserContext, target: Node): Node | null => {
  const peeked = peekToken(ctx);
  if (peeked && peeked.type === TOKEN_OPERATOR && peeked.value === '=') {
    nextToken(ctx);
    const defaultExpr = parseExpression(ctx);
    return nodes.assignmentPattern(target.lineno, target.colno, target, defaultExpr);
  }
  return null;
};

const parseArrayPattern = (ctx: ParserContext, lineno: number, colno: number): Node => {
  const node = nodes.arrayPattern(lineno, colno) as MutableNode;
  const startTok = nextToken(ctx);
  if (startTok.type !== TOKEN_LEFT_BRACKET) {
    fail(ctx, 'parseArrayPattern: expected [', lineno, colno);
  }

  let sawRest = false;
  while (true) {
    const tok = peekToken(ctx);
    if (tok.type === TOKEN_RIGHT_BRACKET) {
      nextToken(ctx);
      break;
    }

    if (node.children.length > 0 && !sawRest) {
      if (!skip(ctx, TOKEN_COMMA)) {
        fail(ctx, 'parseArrayPattern: expected comma',
          tok.lineno,
          tok.colno);
      }
      const after = peekToken(ctx);
      if (after && after.type === TOKEN_RIGHT_BRACKET) {
        nextToken(ctx);
        break;
      }
      if (after && after.type === TOKEN_COMMA) {
        node.addChild(nodes.hole(after.lineno, after.colno));
        continue;
      }
    }

    if (peekToken(ctx).type === TOKEN_SPREAD) {
      nextToken(ctx);
      const inner = parseInnerPattern(ctx);
      const rp = nodes.restPattern(tok.lineno, tok.colno, inner);
      node.addChild(rp);
      sawRest = true;
      const after = peekToken(ctx);
      if (after && after.type === TOKEN_COMMA) {
        nextToken(ctx);
      }
      continue;
    }

    if (peekToken(ctx).type === TOKEN_LEFT_BRACKET) {
      const innerTok = peekToken(ctx);
      const inner = parseArrayPattern(ctx, innerTok.lineno, innerTok.colno);
      const withDefault = parseAssignmentDefault(ctx, inner);
      node.addChild(withDefault ?? inner);
      continue;
    }

    if (peekToken(ctx).type === TOKEN_LEFT_CURLY) {
      const innerTok = peekToken(ctx);
      const inner = parseObjectPattern(ctx, innerTok.lineno, innerTok.colno);
      const withDefault = parseAssignmentDefault(ctx, inner);
      node.addChild(withDefault ?? inner);
      continue;
    }

    const symTok = nextToken(ctx);
    if (!symTok || symTok.type !== TOKEN_SYMBOL) {
      fail(ctx, 'parseArrayPattern: expected symbol in pattern',
        symTok?.lineno ?? tok.lineno, symTok?.colno ?? tok.colno);
    }
    const target = nodes.symbol(symTok!.lineno, symTok!.colno, symTok!.value as string);
    const withDefault = parseAssignmentDefault(ctx, target);
    node.addChild(withDefault ?? target);
  }

  return node;
};

const parseObjectPattern = (ctx: ParserContext, lineno: number, colno: number): Node => {
  const node = nodes.objectPattern(lineno, colno) as MutableNode;
  const startTok = nextToken(ctx);
  if (startTok.type !== TOKEN_LEFT_CURLY) {
    fail(ctx, 'parseObjectPattern: expected {', lineno, colno);
  }

  let sawRest = false;
  while (true) {
    const tok = peekToken(ctx);
    if (tok.type === TOKEN_RIGHT_CURLY) {
      nextToken(ctx);
      break;
    }

    if (node.children.length > 0 && !sawRest) {
      if (!skip(ctx, TOKEN_COMMA)) {
        fail(ctx, 'parseObjectPattern: expected comma',
          tok.lineno,
          tok.colno);
      }
      const after = peekToken(ctx);
      if (after && after.type === TOKEN_RIGHT_CURLY) {
        nextToken(ctx);
        break;
      }
      if (after && after.type === TOKEN_COMMA) {
        continue;
      }
    }

    if (peekToken(ctx).type === TOKEN_SPREAD) {
      nextToken(ctx);
      const inner = parseInnerPattern(ctx);
      node.addChild(nodes.restPattern(tok.lineno, tok.colno, inner));
      sawRest = true;
      const after = peekToken(ctx);
      if (after && after.type === TOKEN_COMMA) {
        nextToken(ctx);
      }
      continue;
    }

    let keyTok = nextToken(ctx);
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

    let valueTarget: Node;
    if (skip(ctx, TOKEN_COLON)) {
      if (peekToken(ctx).type === TOKEN_LEFT_BRACKET) {
        const t = peekToken(ctx);
        valueTarget = parseArrayPattern(ctx, t.lineno, t.colno);
      } else if (peekToken(ctx).type === TOKEN_LEFT_CURLY) {
        const t = peekToken(ctx);
        valueTarget = parseObjectPattern(ctx, t.lineno, t.colno);
      } else {
        valueTarget = parseInnerPattern(ctx);
      }
    } else {
      valueTarget = nodes.symbol(keyTok.lineno, keyTok.colno, keyName as string);
    }

    const withDefault = parseAssignmentDefault(ctx, valueTarget);
    const propNode = nodes.patternProperty(
      keyTok.lineno,
      keyTok.colno,
      keyName as unknown as Node,
      withDefault ?? valueTarget
    );
    node.addChild(propNode);
  }

  return node;
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
