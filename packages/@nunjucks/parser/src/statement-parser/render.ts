import { renderNode } from '@nunjucks/nodes';
import { funCall, isFunCall } from '@nunjucks/nodes';
import type { Node, SlotBlock } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";
import { parseSlottedBody, buildDefaultBody, advanceAfterTags } from "./slots.ts";
import { loc } from '@nunjucks/shared';

export const parseRenderBlock = (parserContext: ParserContext): Node => {
  const tag = peekToken(parserContext);
  if (!skipSymbol(parserContext, 'render')) {
    fail(parserContext, 'Expected render', tag.lineno, tag.colno);
  }

  const parsed = parseExpression(parserContext);
  const callExpr = isFunCall(parsed) ? parsed : funCall(loc(tag), { name: parsed });
  advanceAfterBlockEnd(parserContext, 'render');

  const { defaultParts, namedSlots, implicitSlots } = parseSlottedBody(parserContext, 'endrender');
  advanceAfterTags(parserContext, 'endrender');

  const providedSlots: SlotBlock[] = [];
  const body = buildDefaultBody(defaultParts, tag.lineno, tag.colno);
  if (defaultParts.length > 0) {
    providedSlots.push({ name: 'default', params: [], body });
  }
  providedSlots.push(...implicitSlots, ...namedSlots);

  return renderNode(loc(tag), { callExpr, body, providedSlots });
};