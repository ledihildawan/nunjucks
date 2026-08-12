import {
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_CURLY,
  TOKEN_LEFT_PAREN,
} from '@nunjucks/lexer';
import { array, dict, group } from '@nunjucks/nodes';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { loc } from '@nunjucks/lexer';
import type { Loc } from '@nunjucks/lexer';
import { ok, isErr, type Result } from '@nunjucks/lib';
import { nextToken } from '../../cursor.ts';
import type { ParserContext } from '../../cursor.ts';
import { parseContent } from './parse-content.ts';

const createAggregateNode = (
  type: string,
  loc: Loc
): ChildrenNode | null => {
  switch (type) {
    case TOKEN_LEFT_PAREN:
      return group(loc);
    case TOKEN_LEFT_BRACKET:
      return array(loc);
    case TOKEN_LEFT_CURLY:
      return dict(loc);
    default:
      return null;
  }
};

export const parseAggregate = (parserContext: ParserContext): Result<Node | null, TemplateError> => {
  const tokenR = nextToken(parserContext);
  if (isErr(tokenR)) { return tokenR; }
  const token = tokenR.value;
  const node = createAggregateNode(token.type, loc(token));
  if (!node) {
    return ok(null);
  }
  const contentR = parseContent(parserContext, node, token);
  if (isErr(contentR)) { return contentR; }
  return ok(contentR.value);
};
