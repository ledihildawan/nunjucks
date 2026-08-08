import type { ChildrenNode, NodeLocation } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import { ok, isErr, type Result } from '@nunjucks/shared';
import type { ParserContext } from '../../cursor.ts';
import { parseAggregateExpression } from './parse-expressions.ts';
import { prepareListItem } from './parse-list.ts';

export const parseContent = (
  parserContext: ParserContext,
  initialNode: ChildrenNode,
  origin: NodeLocation
): Result<ChildrenNode, TemplateError> => {
  let node = initialNode;
  for (;;) {
    const listR = prepareListItem(parserContext, node, origin);
    if (isErr(listR)) { return listR; }
    const listState = listR.value;
    node = listState.node;
    if (listState.done) {
      return ok(node);
    }
    if (listState.skipExpression) {
      continue;
    }
    const exprR = parseAggregateExpression(parserContext, node, origin);
    if (isErr(exprR)) { return exprR; }
    node = exprR.value;
  }
};
