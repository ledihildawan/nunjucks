import type { Node } from '@nunjucks/nodes';
import { TOKEN_OPERATOR } from '@nunjucks/lexer';
import { peekToken, skipValue } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';

type BinNodeFn = (lineno: number, colno: number, left: Node, right: Node) => Node;

const binaryOp = (
  parserContext: ParserContext,
  create: BinNodeFn,
  consume: (parserContext: ParserContext) => boolean,
  next: (parserContext: ParserContext) => Node
): Node => {
  let node = next(parserContext);
  let tok = peekToken(parserContext);
  while (consume(parserContext)) {
    const node2 = next(parserContext);
    node = create(tok.lineno, tok.colno, node, node2);
    tok = peekToken(parserContext);
  }
  return node;
};

const op = (operator: string) => (parserContext: ParserContext): boolean => skipValue(parserContext, TOKEN_OPERATOR, operator);

export { binaryOp, op };
export type { BinNodeFn };
