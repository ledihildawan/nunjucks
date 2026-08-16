import type { TemplateError } from '@nunjucks/error-formatter';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { ChildrenNode, NodeLocation } from '@nunjucks/nodes';
import type { ParserContext } from '../../cursor.ts';
import { parseAggregateExpression } from './parse-expressions.ts';
import { prepareListItem } from './parse-list.ts';

export const parseContent = (
  parserContext: ParserContext,
  initialNode: ChildrenNode,
  origin: NodeLocation
): Result<ChildrenNode, TemplateError> => {
  // WHY: iterative loop (parser loop exemption) — per-element recursion overflows the stack on
  // large aggregate literals (e.g. tens of thousands of array items).
  let currentNode = initialNode;
  while (true) {
    const listR = prepareListItem(parserContext, currentNode, origin);
    if (isErr(listR)) {
      return listR;
    }
    const listState = listR.value;
    currentNode = listState.node;
    if (listState.done) {
      return ok(currentNode);
    }
    if (listState.skipExpression) {
      continue;
    }
    const exprR = parseAggregateExpression(parserContext, currentNode, origin);
    if (isErr(exprR)) {
      return exprR;
    }
    currentNode = exprR.value;
  }
};
