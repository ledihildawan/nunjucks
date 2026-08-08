import {
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_CURLY,
  TOKEN_LEFT_PAREN,
} from '@nunjucks/lexer';
import { array, dict, group } from '@nunjucks/nodes';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { Loc } from '@nunjucks/shared';
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

export const parseAggregate = (parserContext: ParserContext): Node | null => {
  const token = nextToken(parserContext);
  const node = createAggregateNode(token.type, loc(token));
  if (!node) {
    return null;
  }
  return parseContent(parserContext, node, token);
};
