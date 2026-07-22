import { and, not, or } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, skipSymbol, skipOperator, nextToken } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { TOKEN_OPERATOR } from '@nunjucks/lexer';
import { parseNullishCoalesce } from "./nullish.ts";
import { parseIn } from "./in.ts";

export const parseOr = (ctx: ParserContext): Node => {
  let node = parseNullishCoalesce(ctx);
  let tok = peekToken(ctx);
  while (skipSymbol(ctx, 'or') || skipOperator(ctx, '||')) {
    const node2 = parseNullishCoalesce(ctx);
    node = or(tok.lineno, tok.colno, node, node2);
    tok = peekToken(ctx);
  }
  return node;
};

export const parseAnd = (ctx: ParserContext): Node => {
  let node = parseNot(ctx);
  let tok = peekToken(ctx);
  while (skipSymbol(ctx, 'and') || skipOperator(ctx, '&&')) {
    const node2 = parseNot(ctx);
    node = and(tok.lineno, tok.colno, node, node2);
    tok = peekToken(ctx);
  }
  return node;
};

export const parseNot = (ctx: ParserContext): Node => {
  const tok = peekToken(ctx);
  if (!tok) {
    return parseIn(ctx);
  }
  if (tok.type === TOKEN_OPERATOR && tok.value === '!') {
    nextToken(ctx);
    return not(tok.lineno, tok.colno, parseNot(ctx));
  }
  if (skipSymbol(ctx, 'not')) {
    return not(tok.lineno, tok.colno, parseNot(ctx));
  }
  if (skipOperator(ctx, '!')) {
    return not(tok.lineno, tok.colno, parseNot(ctx));
  }
  return parseIn(ctx);
};
