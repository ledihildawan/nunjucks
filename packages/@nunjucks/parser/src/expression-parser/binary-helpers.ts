import type { Node } from '@nunjucks/nodes';
import type { BinaryFields } from '@nunjucks/nodes';
import type { Loc } from '@nunjucks/lexer';
import { loc } from '@nunjucks/lexer';
import { ok, isErr, type Result } from '@nunjucks/lib';
import type { TemplateError } from '@nunjucks/error-formatter';
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

  const fold = (node: Node): Result<Node, TemplateError> => {
    const tokR = peekToken(parserContext);
    if (isErr(tokR)) { return tokR; }
    if (!consume(parserContext)) {
      return ok(node);
    }
    const rightR = next(parserContext);
    if (isErr(rightR)) { return rightR; }
    return fold(create(loc(tokR.value), { left: node, right: rightR.value }));
  };

  return fold(firstR.value);
};

const op = (operator: string) => (parserContext: ParserContext): boolean => skipValue(parserContext, TOKEN_OPERATOR, operator);

export { binaryOp, op };
export type { BinNodeFn };
