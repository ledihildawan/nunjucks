import type { Node } from '@nunjucks/nodes';
import type { Loc } from '@nunjucks/shared';
import { loc } from '@nunjucks/shared';
import { TOKEN_OPERATOR } from '@nunjucks/lexer';
import { peekToken, skipValue } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';

type BinNodeFn = (loc: Loc, left: Node, right: Node) => Node;

const binaryOp = (
  parserContext: ParserContext,
  create: BinNodeFn,
  consume: (parserContext: ParserContext) => boolean,
  next: (parserContext: ParserContext) => Node
): Node => {
  let node = next(parserContext);
  let tok = peekToken(parserContext);
  while (consume(parserContext)) {
    const rightNode = next(parserContext);
    node = create(loc(tok), node, rightNode);
    tok = peekToken(parserContext);
  }
  return node;
};

const op = (operator: string) => (parserContext: ParserContext): boolean => skipValue(parserContext, TOKEN_OPERATOR, operator);

export { binaryOp, op };
export type { BinNodeFn };
