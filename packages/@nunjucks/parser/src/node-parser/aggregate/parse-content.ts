import type { ChildrenNode, NodeLocation } from '@nunjucks/nodes';
import type { ParserContext } from '../../cursor.ts';
import { parseAggregateExpression } from './parse-expressions.ts';
import { prepareListItem } from './parse-list.ts';

export const parseContent = (
  parserContext: ParserContext,
  initialNode: ChildrenNode,
  origin: NodeLocation
): ChildrenNode => {
  let node = initialNode;
  for (;;) {
    const listState = prepareListItem(parserContext, node, origin);
    node = listState.node;
    if (listState.done) {
      return node;
    }
    if (listState.skipExpression) {
      continue;
    }
    node = parseAggregateExpression(parserContext, node, origin);
  }
};
