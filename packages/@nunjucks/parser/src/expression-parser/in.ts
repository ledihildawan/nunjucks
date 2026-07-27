import { TOKEN_SYMBOL } from '@nunjucks/lexer';
import { in_, not } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { nextToken, pushToken } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseBitwiseOr } from "./bitwise.ts";
import { parseIs } from "./is.ts";

const isInToken = (tok: ReturnType<typeof nextToken>): boolean =>
  tok && tok.type === TOKEN_SYMBOL && tok.value === 'in';

const isNotInversion = (tok: ReturnType<typeof nextToken>): boolean =>
  tok && tok.type === TOKEN_SYMBOL && tok.value === 'not';

const handleInExpression = (ctx: ParserContext, node: Node, invert: boolean, inTok: ReturnType<typeof nextToken>): Node => {
  const node2 = parseIs(ctx);
  const newNode = in_(inTok.lineno, inTok.colno, node, node2);
  return invert ? not(inTok.lineno, inTok.colno, newNode) : newNode;
};

const processInToken = (ctx: ParserContext, node: Node, invert: boolean, inTok: ReturnType<typeof nextToken>): Node | null => {
  if (isInToken(inTok)) {
    return parseInLoop(ctx, handleInExpression(ctx, node, invert, inTok));
  }
  if (inTok) { pushToken(ctx, inTok); }
  return null;
};

const parseInLoop = (ctx: ParserContext, node: Node): Node => {
  const tok = nextToken(ctx);
  if (!tok) { return node; }

  const invert = isNotInversion(tok);
  if (!invert && !isInToken(tok)) {
    pushToken(ctx, tok);
    return node;
  }

  const inTok = invert ? nextToken(ctx) : tok;
  const result = processInToken(ctx, node, invert, inTok);
  return result ?? node;
};

export const parseIn = (ctx: ParserContext): Node => {
  const node = parseBitwiseOr(ctx);
  return parseInLoop(ctx, node);
};
