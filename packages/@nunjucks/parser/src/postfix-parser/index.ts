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
  // The parameter stays untouched; `current` carries the growing expression.
  let current = node;

  while (tok) {
    if (tok.type === TOKEN_LEFT_PAREN) {
      current = parseFunCall(ctx, tok, current);
    } else if (tok.type === TOKEN_LEFT_BRACKET) {
      const bracketTok = nextToken(ctx);
      current = parseBracketAccess(ctx, bracketTok, current);
    } else if (tok.type === TOKEN_OPERATOR && tok.value === '.') {
      current = parseDotAccess(ctx, tok, current);
    } else if (tok.type === TOKEN_OPERATOR && tok.value === '?.') {
      current = parseOptionalChain(ctx, tok, current);
    } else if (tok.type === TOKEN_OPERATOR && tok.value === '++') {
      nextToken(ctx);
      current = increment(tok.lineno, tok.colno, current, true);
    } else if (tok.type === TOKEN_OPERATOR && tok.value === '--') {
      nextToken(ctx);
      current = decrement(tok.lineno, tok.colno, current, true);
    } else {
      break;
    }

    tok = peekToken(ctx);
  }

  return current;
};

export { parsePipeForward, parseFilterCallName, parseFilterCallArgs } from './pipe-forward.ts';
