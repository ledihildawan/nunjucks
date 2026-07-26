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

export const parsePostfix = (ctx: ParserContext, node: Node): Node => {
  let tok = peekToken(ctx);

  while (tok) {
    if (tok.type === TOKEN_LEFT_PAREN) {
      node = parseFunCall(ctx, tok, node);
    } else if (tok.type === TOKEN_LEFT_BRACKET) {
      const bracketTok = nextToken(ctx);
      node = parseBracketAccess(ctx, bracketTok, node);
    } else if (tok.type === TOKEN_OPERATOR && tok.value === '.') {
      node = parseDotAccess(ctx, tok, node);
    } else if (tok.type === TOKEN_OPERATOR && tok.value === '?.') {
      node = parseOptionalChain(ctx, tok, node);
    } else if (tok.type === TOKEN_OPERATOR && tok.value === '++') {
      nextToken(ctx);
      node = increment(tok.lineno, tok.colno, node, true);
    } else if (tok.type === TOKEN_OPERATOR && tok.value === '--') {
      nextToken(ctx);
      node = decrement(tok.lineno, tok.colno, node, true);
    } else {
      break;
    }

    tok = peekToken(ctx);
  }

  return node;
};

export { parsePipeForward, parseFilterCallName, parseFilterCallArgs } from './pipe-forward.ts';
