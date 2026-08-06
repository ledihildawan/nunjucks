import { renderBlock } from '@nunjucks/nodes';
import { funCall, isFunCall } from '@nunjucks/nodes';
import type { Node, SlotBlock } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseExpression } from "../expression-parser/index.ts";
import { parseSlottedBody, buildDefaultBody, advanceAfterTags } from "./slots.ts";

export const parseRenderBlock = (ctx: ParserContext): Node => {
  const tag = peekToken(ctx);
  if (!skipSymbol(ctx, 'render')) {
    fail(ctx, 'Expected render', tag.lineno, tag.colno);
  }

  const parsed = parseExpression(ctx);
  const callExpr = isFunCall(parsed) ? parsed : funCall(tag.lineno, tag.colno, parsed);
  advanceAfterBlockEnd(ctx, 'render');

  const { defaultParts, namedSlots, implicitSlots } = parseSlottedBody(ctx, 'endrender');
  advanceAfterTags(ctx, 'endrender');

  // The default slot is only "provided" when the body actually has content —
  // plain text or an unnamed `{% slot %}` block. An empty
  // {% render %}{% endrender %} means the consumer made no decision, so the
  // component's own default children fallback wins. Explicit
  // `{% slot default(...) %}` blocks carry their own params.
  const providedSlots: SlotBlock[] = [];
  const body = buildDefaultBody(defaultParts, tag.lineno, tag.colno);
  if (defaultParts.length > 0) {
    providedSlots.push({ name: 'default', params: [], body });
  }
  providedSlots.push(...implicitSlots, ...namedSlots);

  return renderBlock(tag.lineno, tag.colno, { callExpr, body, providedSlots });
};