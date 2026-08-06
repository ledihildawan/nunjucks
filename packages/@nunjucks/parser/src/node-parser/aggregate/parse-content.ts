import type { ChildrenNode, NodeLocation } from '@nunjucks/nodes';
import type { ParserContext } from '../../cursor.ts';
import { parseAggregateExpression } from './parse-expressions.ts';
import { prepareListItem } from './parse-list.ts';

export const parseContent = (
  ctx: ParserContext,
  initialNode: ChildrenNode,
  origin: NodeLocation
): ChildrenNode => {
  let node = initialNode;
  for (;;) {
    const listState = prepareListItem(ctx, node, origin);
    node = listState.node;
    if (listState.done) {
      return node;
    }
    if (listState.skipExpression) {
      continue;
    }
    node = parseAggregateExpression(ctx, node, origin);
  }
};
