import { renderNode } from '@nunjucks/nodes';
import { funCall, isFunCall } from '@nunjucks/nodes';
import type { Node, SlotBlock } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/error-formatter';
import { peekToken, skipSymbol, advanceAfterBlockEnd, fail } from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { ok, isErr, type Result } from '@nunjucks/lib';
import { parseExpression } from "../expression-parser/index.ts";
import { parseSlottedBody, buildDefaultBody, advanceAfterTags } from "./slots.ts";
import { loc } from '@nunjucks/shared';

export const parseRenderBlock = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) { return tagR; }
  const tag = tagR.value;
  if (!skipSymbol(parserContext, 'render')) {
    return fail(parserContext, 'Expected render', { lineno: tag.lineno, colno: tag.colno });
  }

  const parsedR = parseExpression(parserContext);
  if (isErr(parsedR)) { return parsedR; }
  const parsed = parsedR.value;
  const callExpr = isFunCall(parsed) ? parsed : funCall(loc(tag), { name: parsed });
  const blockEndR = advanceAfterBlockEnd(parserContext, 'render');
  if (isErr(blockEndR)) { return blockEndR; }

  const slotsR = parseSlottedBody(parserContext, 'endrender');
  if (isErr(slotsR)) { return slotsR; }
  const { defaultParts, namedSlots, implicitSlots } = slotsR.value;
  const tagsR = advanceAfterTags(parserContext, 'endrender');
  if (isErr(tagsR)) { return tagsR; }

  const providedSlots: SlotBlock[] = [];
  const body = buildDefaultBody(defaultParts, tag.lineno, tag.colno);
  if (defaultParts.length > 0) {
    providedSlots.push({ name: 'default', params: [], body });
  }
  providedSlots.push(...implicitSlots, ...namedSlots);

  return ok(renderNode(loc(tag), { callExpr, body, providedSlots }));
};
