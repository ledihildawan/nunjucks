import {
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_PAREN,
  TOKEN_OPERATOR,
} from '@nunjucks/lexer';
import { decrement, increment } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { nextToken, peekToken, } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseFunCall } from "./fun-call.ts";
import { parseBracketAccess } from "./lookup.ts";
import { parseDotAccess } from "./dot.ts";
import { parseOptionalChain } from "./optional.ts";

type PostfixHandler = (ctx: ParserContext, tok: ReturnType<typeof peekToken>, current: Node) => Node;

const handleFunCall: PostfixHandler = (ctx, tok, current) =>
  parseFunCall(ctx, tok as Parameters<typeof parseFunCall>[1], current);

const handleBracketAccess: PostfixHandler = (ctx, _tok, current) => {
  const bracketTok = nextToken(ctx);
  return parseBracketAccess(ctx, bracketTok, current);
};

const handleDotAccess: PostfixHandler = (ctx, tok, current) =>
  parseDotAccess(ctx, tok as Parameters<typeof parseDotAccess>[1], current);

const handleOptionalChain: PostfixHandler = (ctx, tok, current) =>
  parseOptionalChain(ctx, tok as Parameters<typeof parseOptionalChain>[1], current);

const handleIncrement: PostfixHandler = (ctx, tok, current) => {
  nextToken(ctx);
  return increment(tok.lineno, tok.colno, current, true);
};

const handleDecrement: PostfixHandler = (ctx, tok, current) => {
  nextToken(ctx);
  return decrement(tok.lineno, tok.colno, current, true);
};

const POSTFIX_HANDLERS: Array<{ type?: string; value?: string; handler: PostfixHandler }> = [
  { type: TOKEN_LEFT_PAREN, handler: handleFunCall },
  { type: TOKEN_LEFT_BRACKET, handler: handleBracketAccess },
  { type: TOKEN_OPERATOR, value: '.', handler: handleDotAccess },
  { type: TOKEN_OPERATOR, value: '?.', handler: handleOptionalChain },
  { type: TOKEN_OPERATOR, value: '++', handler: handleIncrement },
  { type: TOKEN_OPERATOR, value: '--', handler: handleDecrement },
];

export const parsePostfix = (ctx: ParserContext, node: Node): Node => {
  let tok = peekToken(ctx);
  let current = node;

  while (tok) {
    const handlerEntry = POSTFIX_HANDLERS.find(h =>
      h.type === tok.type && (h.value === undefined || h.value === tok.value)
    );

    if (handlerEntry) {
      current = handlerEntry.handler(ctx, tok, current);
    } else {
      break;
    }

    tok = peekToken(ctx);
  }

  return current;
};

export { parsePipeForward, parseFilterCallName, parseFilterCallArgs } from './pipe-forward.ts';
