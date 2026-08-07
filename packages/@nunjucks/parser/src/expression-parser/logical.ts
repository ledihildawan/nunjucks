import { TOKEN_OPERATOR, TOKEN_COLON } from '@nunjucks/lexer';
import { nullishCoalesce, and, or, not, inlineIf } from '@nunjucks/nodes';
import type { Node } from '@nunjucks/nodes';
import { peekToken, nextToken, skipSymbol, skipOperator, skipValue } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';
import { binaryOp } from './binary-helpers.ts';
import { parseIn } from './comparison.ts';

const parseNullishCoalesce = (parserContext: ParserContext): Node =>
  binaryOp(parserContext, nullishCoalesce, (c) => skipValue(c, TOKEN_OPERATOR, '??'), parseAnd);

const parseNot = (parserContext: ParserContext): Node => {
  const tok = peekToken(parserContext);
  if (!tok) {
    return parseIn(parserContext);
  }
  if (tok.type === TOKEN_OPERATOR && tok.value === '!') {
    nextToken(parserContext);
    return not(tok.lineno, tok.colno, parseNot(parserContext));
  }
  if (skipSymbol(parserContext, 'not')) {
    return not(tok.lineno, tok.colno, parseNot(parserContext));
  }
  if (skipOperator(parserContext, '!')) {
    return not(tok.lineno, tok.colno, parseNot(parserContext));
  }
  return parseIn(parserContext);
};

const parseAnd = (parserContext: ParserContext): Node =>
  binaryOp(parserContext, and, (c) => skipSymbol(c, 'and') || skipOperator(c, '&&'), parseNot);

const parseOr = (parserContext: ParserContext): Node =>
  binaryOp(parserContext, or, (c) => skipSymbol(c, 'or') || skipOperator(c, '||'), parseNullishCoalesce);

const parseTernary = (parserContext: ParserContext, node: Node): Node => {
  if (skipValue(parserContext, TOKEN_OPERATOR, '?')) {
    const thenNode = parseOr(parserContext);
    if (skipValue(parserContext, TOKEN_COLON, ':')) {
      const elseNode = parseOr(parserContext);
      const newNode = inlineIf(node.lineno, node.colno, { cond: node, body: thenNode, else_: elseNode });
      return parseTernary(parserContext, newNode);
    }
  }
  return node;
};

export { parseOr, parseTernary };
