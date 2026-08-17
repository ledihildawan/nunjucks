import type { TemplateError } from '@nunjucks/error-formatter';
import { TOKEN_OPERATOR } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { BinaryFields, Node } from '@nunjucks/nodes';
import type { Loc } from '@nunjucks/shared';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { peekToken, skipValue } from '../cursor.ts';

/** Constructs a binary AST node from a source location and operand fields. */
type BinNodeFn = (loc: Loc, fields: BinaryFields) => Node;

interface BinaryOpOptions {
  create: BinNodeFn;
  consume: (parserContext: ParserContext) => boolean;
  next: (parserContext: ParserContext) => Result<Node, TemplateError>;
}

/**
 * Generic left-associative binary-operator fold: parses the tighter `next`
 * level once, then repeatedly consumes the operator via `consume` and folds
 * each right operand into a node built by `create`.
 */
const binaryOp = (
  parserContext: ParserContext,
  { create, consume, next }: BinaryOpOptions
): Result<Node, TemplateError> => {
  const firstR = next(parserContext);
  if (isErr(firstR)) {
    return firstR;
  }

  const fold = (node: Node): Result<Node, TemplateError> => {
    const tokR = peekToken(parserContext);
    if (isErr(tokR)) {
      return tokR;
    }
    if (!consume(parserContext)) {
      return ok(node);
    }
    const rightR = next(parserContext);
    if (isErr(rightR)) {
      return rightR;
    }
    return fold(create(loc(tokR.value), { left: node, right: rightR.value }));
  };

  return fold(firstR.value);
};

/** Builds a `consume` callback matching a single operator literal, e.g. `+`. */
const op =
  (operator: string) =>
  (parserContext: ParserContext): boolean =>
    skipValue(parserContext, TOKEN_OPERATOR, operator);

export type { BinNodeFn };
export { binaryOp, op };
