import {
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_CURLY,
  TOKEN_LEFT_PAREN,
} from '@nunjucks/lexer';
import { array, dict, group } from '@nunjucks/nodes';
import type { ChildrenNode, Node } from '@nunjucks/nodes';
import { nextToken } from '../../cursor.ts';
import type { ParserContext } from '../../cursor.ts';
import { parseContent } from './parse-content.ts';

const createAggregateNode = (
  type: string,
  lineno: number,
  colno: number
): ChildrenNode | null => {
  switch (type) {
    case TOKEN_LEFT_PAREN:
      return group(lineno, colno);
    case TOKEN_LEFT_BRACKET:
      return array(lineno, colno);
    case TOKEN_LEFT_CURLY:
      return dict(lineno, colno);
    default:
      return null;
  }
};

export const parseAggregate = (parserContext: ParserContext): Node | null => {
  const token = nextToken(parserContext);
  const node = createAggregateNode(token.type, token.lineno, token.colno);
  if (!node) {
    return null;
  }
  return parseContent(parserContext, node, token);
};
