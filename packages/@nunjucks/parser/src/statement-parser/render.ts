import type { TemplateError } from '@nunjucks/error-formatter';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node, SlotBlock } from '@nunjucks/nodes';
import { funCall, isFunCall, renderNode } from '@nunjucks/nodes';
import { loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import { advanceAfterBlockEnd, fail, peekToken, skipSymbol } from '../cursor.ts';
import { parseExpression } from '../expression-parser/index.ts';
import { advanceAfterTags, buildDefaultBody, parseSlottedBody } from './slots.ts';

export const parseRenderBlock = (parserContext: ParserContext): Result<Node, TemplateError> => {
  const tagR = peekToken(parserContext);
  if (isErr(tagR)) {
    return tagR;
  }
  const tag = tagR.value;
  if (!skipSymbol(parserContext, 'render')) {
    return fail(parserContext, 'Expected render', { lineno: tag.lineno, colno: tag.colno });
  }

  const parsedR = parseExpression(parserContext);
  if (isErr(parsedR)) {
    return parsedR;
  }
  const parsed = parsedR.value;
  const callExpr = isFunCall(parsed) ? parsed : funCall(loc(tag), { name: parsed });
  const blockEndR = advanceAfterBlockEnd(parserContext, 'render');
  if (isErr(blockEndR)) {
    return blockEndR;
  }

  const slotsR = parseSlottedBody(parserContext, 'endrender');
  if (isErr(slotsR)) {
    return slotsR;
  }
  const { defaultParts, namedSlots, implicitSlots } = slotsR.value;
  const tagsR = advanceAfterTags(parserContext, 'endrender');
  if (isErr(tagsR)) {
    return tagsR;
  }

  const providedSlots: SlotBlock[] = [];
  const body = buildDefaultBody(defaultParts, loc(tag));
  if (defaultParts.length > 0) {
    providedSlots.push({ name: 'default', params: [], body });
  }
  providedSlots.push(...implicitSlots, ...namedSlots);

  return ok(renderNode(loc(tag), { callExpr, body, providedSlots }));
};
