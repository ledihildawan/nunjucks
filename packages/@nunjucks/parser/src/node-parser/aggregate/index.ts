import type { TemplateError } from '@nunjucks/error-formatter';
import { TOKEN_LEFT_BRACKET, TOKEN_LEFT_CURLY, TOKEN_LEFT_PAREN } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import { array, dict, group } from '@nunjucks/nodes';
import type { Loc } from '@nunjucks/shared';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../../cursor.ts';
import { nextToken } from '../../cursor.ts';
import { parseContent } from './parse-content.ts';

const createAggregateNode = (type: string, origin: Loc): ChildrenNode | null => {
  switch (type) {
    case TOKEN_LEFT_PAREN:
      return group(origin);
    case TOKEN_LEFT_BRACKET:
      return array(origin);
    case TOKEN_LEFT_CURLY:
      return dict(origin);
    default:
      return null;
  }
};

export const parseAggregate = (
  parserContext: ParserContext
): Result<Node | null, TemplateError> => {
  const tokenR = nextToken(parserContext);
  if (isErr(tokenR)) {
    return tokenR;
  }
  const token = tokenR.value;
  const node = createAggregateNode(token.type, loc(token));
  if (!node) {
    return ok(null);
  }
  const contentR = parseContent(parserContext, node, token);
  if (isErr(contentR)) {
    return contentR;
  }
  return ok(contentR.value);
};
