import type { Node } from '@nunjucks/nodes';
import type { BinaryFields } from '@nunjucks/nodes';
import type { Loc } from '@nunjucks/shared';
import { loc, ok, isOk, isErr, type Result } from '@nunjucks/shared';
import type { TemplateError } from '@nunjucks/log';
import { TOKEN_OPERATOR } from '@nunjucks/lexer';
import { peekToken, skipValue } from '../cursor.ts';
import type { ParserContext } from '../cursor.ts';

type BinNodeFn = (loc: Loc, fields: BinaryFields) => Node;

const binaryOp = (
  parserContext: ParserContext,
  create: BinNodeFn,
  consume: (parserContext: ParserContext) => boolean,
  next: (parserContext: ParserContext) => Result<Node, TemplateError>
): Result<Node, TemplateError> => {
  const firstR = next(parserContext);
  if (isErr(firstR)) { return firstR; }
  let node = firstR.value;
  let tokR = peekToken(parserContext);
  while (isOk(tokR) && consume(parserContext)) {
    const rightR = next(parserContext);
    if (isErr(rightR)) { return rightR; }
    node = create(loc(tokR.value), { left: node, right: rightR.value });
    tokR = peekToken(parserContext);
  }
  if (isErr(tokR)) { return tokR; }
  return ok(node);
};

const op = (operator: string) => (parserContext: ParserContext): boolean => skipValue(parserContext, TOKEN_OPERATOR, operator);

export { binaryOp, op };
export type { BinNodeFn };
