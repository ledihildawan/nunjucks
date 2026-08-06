import type { Node } from '@nunjucks/nodes';
import { TOKEN_OPERATOR } from '@nunjucks/lexer';
import { peekToken, skipValue } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';

type BinNodeFn = (lineno: number, colno: number, left: Node, right: Node) => Node;

const binaryOp = (
  ctx: ParserContext,
  create: BinNodeFn,
  consume: (ctx: ParserContext) => boolean,
  next: (ctx: ParserContext) => Node
): Node => {
  let node = next(ctx);
  let tok = peekToken(ctx);
  while (consume(ctx)) {
    const node2 = next(ctx);
    node = create(tok.lineno, tok.colno, node, node2);
    tok = peekToken(ctx);
  }
  return node;
};

const op = (operator: string) => (ctx: ParserContext): boolean => skipValue(ctx, TOKEN_OPERATOR, operator);

export { binaryOp, op };
export type { BinNodeFn };
