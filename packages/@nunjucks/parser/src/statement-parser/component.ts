import { isSymbol, component } from '@nunjucks/nodes';
import type { Node, SlotBlock } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parsePrimary } from "../expression-parser/index.ts";
import { parseSignature } from "../node-parser/signature.ts";
import { parseSlottedBody, buildDefaultBody, advanceAfterTags } from "./slots.ts";

export const parseComponent = (ctx: ParserContext): Node => {
  const compTok = peekToken(ctx);
  if (!skipSymbol(ctx, 'component')) {
    fail(ctx, 'expected component');
  }

  const name = parsePrimary(ctx, true);
  const args = parseSignature(ctx, true);
  if (!isSymbol(name)) {
    fail(ctx, 'expected component name', compTok.lineno, compTok.colno);
  }

  advanceAfterBlockEnd(ctx, String(compTok.value));
  const { defaultParts, namedSlots, implicitSlots } = parseSlottedBody(ctx, 'endcomponent');
  advanceAfterTags(ctx, 'endcomponent');

  // The component body is definition markup, always rendered. Unnamed
  // `{% slot %}...{% endslot %}` blocks are the default-children fallback.
  const body = buildDefaultBody(defaultParts, compTok.lineno, compTok.colno);
  const fallbackSlots: SlotBlock[] = [
    ...implicitSlots.map(s => ({ ...s, name: 'default' })),
    ...namedSlots,
  ];

  const node = component(compTok.lineno, compTok.colno, {
    name: String(name.value),
    args: args?.children ?? [],
    body,
    fallbackSlots,
  });

  return node;
};
