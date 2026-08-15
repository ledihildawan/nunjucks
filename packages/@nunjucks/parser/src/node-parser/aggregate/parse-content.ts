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
  const parseLoop = (node: ChildrenNode): Result<ChildrenNode, TemplateError> => {
    const listR = prepareListItem(parserContext, node, origin);
    if (isErr(listR)) {
      return listR;
    }
    const listState = listR.value;
    const nextNode = listState.node;
    if (listState.done) {
      return ok(nextNode);
    }
    if (listState.skipExpression) {
      return parseLoop(nextNode);
    }
    const exprR = parseAggregateExpression(parserContext, nextNode, origin);
    if (isErr(exprR)) {
      return exprR;
    }
    return parseLoop(exprR.value);
  };

  return parseLoop(initialNode);
};
