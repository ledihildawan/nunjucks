import type { TemplateError } from '@nunjucks/error-formatter';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { ChildrenNode, Node, NodeLocation } from '@nunjucks/nodes';
import { isDict } from '@nunjucks/nodes';
import type { ParserContext } from '../../cursor.ts';
import { parseAggregateExpression } from './parse-expressions.ts';
import { prepareListItem } from './parse-list.ts';

/**
 * Accumulates array/dict aggregate items one per loop turn until the
 * closing delimiter, mutating a local array to keep large literals O(n).
 */
export const parseContent = (
  parserContext: ParserContext,
  initialNode: ChildrenNode,
  origin: NodeLocation
): Result<ChildrenNode, TemplateError> => {
  // WHY: iterative loop with a local accumulator (parser loop exemption) — per-element recursion
  // overflows the stack on large aggregate literals, and threading the node through the copying
  // appendChild is O(n²) in element count (each append re-copies all accumulated children).
  const children: Node[] = [];
  const dictAggregate = isDict(initialNode);
  while (true) {
    const listR = prepareListItem(parserContext, children.length > 0, origin);
    if (isErr(listR)) {
      return listR;
    }
    const listState = listR.value;
    if (listState.hole !== null) {
      children.push(listState.hole);
    }
    if (listState.done) {
      return ok({ ...initialNode, children });
    }
    if (listState.skipExpression) {
      continue;
    }
    const itemR = parseAggregateExpression(parserContext, dictAggregate, origin);
    if (isErr(itemR)) {
      return itemR;
    }
    children.push(itemR.value);
  }
};
