import { isSymbol, component } from '@nunjucks/nodes';
import type { Node, SlotBlock } from '@nunjucks/nodes';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parsePrimary } from "../expression-parser/index.ts";
import { parseSignature } from "../node-parser/signature.ts";
import { parseSlottedBody, buildDefaultBody, advanceAfterTags } from "./slots.ts";
import { loc } from '@nunjucks/shared';

export const parseComponent = (parserContext: ParserContext): Node => {
  const compTok = peekToken(parserContext);
  if (!skipSymbol(parserContext, 'component')) {
    fail(parserContext, 'expected component');
  }

  const name = parsePrimary(parserContext, true);
  const args = parseSignature(parserContext, true);
  if (!isSymbol(name)) {
    fail(parserContext, 'expected component name', compTok.lineno, compTok.colno);
  }

  advanceAfterBlockEnd(parserContext, String(compTok.value));
  const { defaultParts, namedSlots, implicitSlots } = parseSlottedBody(parserContext, 'endcomponent');
  advanceAfterTags(parserContext, 'endcomponent');

  const body = buildDefaultBody(defaultParts, compTok.lineno, compTok.colno);
  const fallbackSlots: SlotBlock[] = [
    ...implicitSlots.map(s => ({ ...s, name: 'default' })),
    ...namedSlots,
  ];

  const node = component(loc(compTok), {
    name: String(name.value),
    args: args?.children ?? [],
    body,
    fallbackSlots,
  });

  return node;
};
