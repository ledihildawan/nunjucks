import { isSymbol, component } from '@nunjucks/nodes';
import type { Node, SlotBlock } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/lib';
import { parsePrimaryWithoutPostfix } from "../expression-parser/index.ts";
import { parseSignature } from "../node-parser/signature.ts";
import { parseSlottedBody, buildDefaultBody, advanceAfterTags } from "./slots.ts";
import { loc } from '@nunjucks/lexer';

export const parseComponent = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const compTokR = peekToken(parserContext);
  if (isErr(compTokR)) { return compTokR; }
  const compTok = compTokR.value;
  if (!skipSymbol(parserContext, 'component')) {
    return fail(parserContext, 'expected component');
  }

  const nameR = parsePrimaryWithoutPostfix(parserContext);
  if (isErr(nameR)) { return nameR; }
  const name = nameR.value;
  const argsR = parseSignature({ parserContext, tolerant: true });
  if (isErr(argsR)) { return argsR; }
  const args = argsR.value;
  if (!isSymbol(name)) {
    return fail(parserContext, 'expected component name', { lineno: compTok.lineno, colno: compTok.colno });
  }

  const blockEndR = advanceAfterBlockEnd(parserContext, String(compTok.value));
  if (isErr(blockEndR)) { return blockEndR; }
  const slotsR = parseSlottedBody(parserContext, 'endcomponent');
  if (isErr(slotsR)) { return slotsR; }
  const { defaultParts, namedSlots, implicitSlots } = slotsR.value;
  const tagsR = advanceAfterTags(parserContext, 'endcomponent');
  if (isErr(tagsR)) { return tagsR; }

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

  return ok(node);
};
