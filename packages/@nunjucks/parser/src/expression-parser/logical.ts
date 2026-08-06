import { TOKEN_OPERATOR, TOKEN_COLON } from '@nunjucks/lexer';
import { nullishCoalesce, and, or, not, inlineIf } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, nextToken, skipSymbol, skipOperator, skipValue } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';
import { binaryOp } from './internal.ts';
import { parseIn } from './comparison.ts';

const parseNullishCoalesce = (ctx: ParserContext): Node =>
  binaryOp(ctx, nullishCoalesce, (c) => skipValue(c, TOKEN_OPERATOR, '??'), parseAnd);

const parseNot = (ctx: ParserContext): Node => {
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

const parseAnd = (ctx: ParserContext): Node =>
  binaryOp(ctx, and, (c) => skipSymbol(c, 'and') || skipOperator(c, '&&'), parseNot);

const parseOr = (ctx: ParserContext): Node =>
  binaryOp(ctx, or, (c) => skipSymbol(c, 'or') || skipOperator(c, '||'), parseNullishCoalesce);

const parseTernary = (ctx: ParserContext, node: Node): Node => {
  if (skipValue(ctx, TOKEN_OPERATOR, '?')) {
    const thenNode = parseOr(ctx);
    if (skipValue(ctx, TOKEN_COLON, ':')) {
      const elseNode = parseOr(ctx);
      const newNode = inlineIf(node.lineno, node.colno, { cond: node, body: thenNode, else_: elseNode });
      return parseTernary(ctx, newNode);
    }
  }
  return node;
};

export { parseOr, parseTernary };
