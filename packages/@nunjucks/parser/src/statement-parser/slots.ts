import type { Node, SlotBlock } from '@nunjucks/nodes';
import { nodeList, output, templateData } from '@nunjucks/nodes';
import type { TemplateError } from '@nunjucks/log';
import { loc } from '@nunjucks/shared';
import { ok, isErr, type Result } from '@nunjucks/shared';
import {
  TOKEN_LEFT_PAREN, TOKEN_RIGHT_PAREN, TOKEN_COMMA,
  isSymbolToken,
} from '@nunjucks/lexer';
import type { Token } from '@nunjucks/lexer';
import {
  peekToken, skipSymbol, advanceAfterBlockEnd, nextTokenOrNull, nextToken,
} from "../cursor.ts";
import type { ParserContext } from "../cursor.ts";
import { parseUntilBlocks } from "../parse-root.ts";

export interface ParsedSlot {
  name: string;
  params: string[];
  body: Node;
}

export interface SlottedBody {
  defaultParts: Node[];
  namedSlots: SlotBlock[];
  implicitSlots: SlotBlock[];
}

const categorizeSlot = (
  parsed: ParsedSlot,
  namedSlots: SlotBlock[],
  implicitSlots: SlotBlock[]
): void => {
  if (parsed.name === 'default') {
    implicitSlots.push(parsed);
  } else {
    namedSlots.push(parsed);
  }
};

const isTerminatorSymbol = (peeked: Token, endTag: string): boolean =>
  isSymbolToken(peeked) && peeked.value === endTag;

const isSlotSymbol = (peeked: Token): boolean =>
  isSymbolToken(peeked) && peeked.value === 'slot';

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Result unwrap-and-return short-circuits inflate branching
const parseSlotBlock = (parserContext: ParserContext): Result<ParsedSlot, TemplateError> => {
  skipSymbol(parserContext, 'slot');

  const nameTok = nextTokenOrNull(parserContext);
  const name = nameTok && isSymbolToken(nameTok) ? nameTok.value : 'default';

  const params: string[] = [];
  const afterNameR = peekToken(parserContext);
  if (isErr(afterNameR)) { return afterNameR; }
  if (afterNameR.value.type === TOKEN_LEFT_PAREN) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) { return consumedR; }
    while (true) {
      const inner = nextTokenOrNull(parserContext);
      if (!inner || inner.type === TOKEN_RIGHT_PAREN) { break; }
      if (inner.type === TOKEN_COMMA) { continue; }
      if (isSymbolToken(inner)) {
        params.push(inner.value);
      }
    }
  }

  const blockEndR = advanceAfterBlockEnd(parserContext, 'slot');
  if (isErr(blockEndR)) { return blockEndR; }
  const bodyR = parseUntilBlocks(parserContext, 'endslot');
  if (isErr(bodyR)) { return bodyR; }
  skipSymbol(parserContext, 'endslot');
  const finalR = advanceAfterBlockEnd(parserContext, 'endslot');
  if (isErr(finalR)) { return finalR; }

  return ok({ name, params, body: bodyR.value });
};

const appendDefaultChunk = (defaultParts: Node[], chunk: Node): void => {
  if ((chunk.children?.length ?? 0) > 0) {
    defaultParts.push(chunk);
  }
};

export const parseSlottedBody = (parserContext: ParserContext, endTag: string): Result<SlottedBody, TemplateError> => {
  const namedSlots: SlotBlock[] = [];
  const implicitSlots: SlotBlock[] = [];
  const defaultParts: Node[] = [];

  for (;;) {
    const peekedR = peekToken(parserContext);
    if (isErr(peekedR)) { return peekedR; }
    const peeked = peekedR.value;
    if (isTerminatorSymbol(peeked, endTag)) { break; }
    if (isSlotSymbol(peeked)) {
      const slotR = parseSlotBlock(parserContext);
      if (isErr(slotR)) { return slotR; }
      categorizeSlot(slotR.value, namedSlots, implicitSlots);
      continue;
    }
    const chunkR = parseUntilBlocks(parserContext, 'slot', endTag);
    if (isErr(chunkR)) { return chunkR; }
    appendDefaultChunk(defaultParts, chunkR.value);
  }

  return ok({ defaultParts, namedSlots, implicitSlots });
};

export const buildDefaultBody = (parts: Node[], lineno: number, colno: number): Node => {
  const origin = loc({ lineno, colno });
  if (parts.length === 0) {
    return output(origin, [templateData(origin, '')]);
  }
  if (parts.length === 1) {
    return parts[0] as Node;
  }
  return nodeList(origin, parts);
};

export const advanceAfterTags = (parserContext: ParserContext, tag: string): Result<void, TemplateError> => {
  skipSymbol(parserContext, tag);
  const r = advanceAfterBlockEnd(parserContext, tag);
  if (isErr(r)) { return r; }
  return ok(undefined);
};
