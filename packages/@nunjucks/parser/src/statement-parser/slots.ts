import type { TemplateError } from '@nunjucks/error-formatter';
import type { Token } from '@nunjucks/lexer';
import { isSymbolToken, TOKEN_COMMA, TOKEN_LEFT_PAREN, TOKEN_RIGHT_PAREN } from '@nunjucks/lexer';
import { isErr, ok, type Result } from '@nunjucks/lib';
import type { Node, SlotBlock } from '@nunjucks/nodes';
import { nodeList, output, templateData } from '@nunjucks/nodes';
import type { Loc } from '@nunjucks/shared';
import type { ParserContext } from '../cursor.ts';
import {
  advanceAfterBlockEnd,
  nextToken,
  nextTokenOrNull,
  peekToken,
  skipSymbol,
} from '../cursor.ts';
import { parseUntilBlocks } from '../parse-root.ts';

interface ParsedSlot {
  name: string;
  params: string[];
  body: Node;
}

interface SlottedBody {
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

const isSlotSymbol = (peeked: Token): boolean => isSymbolToken(peeked) && peeked.value === 'slot';

const parseSlotParams = (parserContext: ParserContext): string[] => {
  const params: string[] = [];
  const collect = (): string[] => {
    const inner = nextTokenOrNull(parserContext);
    if (!inner || inner.type === TOKEN_RIGHT_PAREN) {
      return params;
    }
    if (inner.type === TOKEN_COMMA) {
      return collect();
    }
    if (isSymbolToken(inner)) {
      params.push(inner.value);
    }
    return collect();
  };
  return collect();
};

const parseSlotBlock = (parserContext: ParserContext): Result<ParsedSlot, TemplateError> => {
  skipSymbol(parserContext, 'slot');

  const nameTok = nextTokenOrNull(parserContext);
  const name = nameTok && isSymbolToken(nameTok) ? nameTok.value : 'default';

  const params: string[] = [];
  const afterNameR = peekToken(parserContext);
  if (isErr(afterNameR)) {
    return afterNameR;
  }
  if (afterNameR.value.type === TOKEN_LEFT_PAREN) {
    const consumedR = nextToken(parserContext);
    if (isErr(consumedR)) {
      return consumedR;
    }
    params.push(...parseSlotParams(parserContext));
  }

  const blockEndR = advanceAfterBlockEnd(parserContext, 'slot');
  if (isErr(blockEndR)) {
    return blockEndR;
  }
  const bodyR = parseUntilBlocks(parserContext, 'endslot');
  if (isErr(bodyR)) {
    return bodyR;
  }
  skipSymbol(parserContext, 'endslot');
  const finalR = advanceAfterBlockEnd(parserContext, 'endslot');
  if (isErr(finalR)) {
    return finalR;
  }

  return ok({ name, params, body: bodyR.value });
};

const appendDefaultChunk = (defaultParts: Node[], chunk: Node): void => {
  if ((chunk.children?.length ?? 0) > 0) {
    defaultParts.push(chunk);
  }
};

export const parseSlottedBody = (
  parserContext: ParserContext,
  endTag: string
): Result<SlottedBody, TemplateError> => {
  const namedSlots: SlotBlock[] = [];
  const implicitSlots: SlotBlock[] = [];
  const defaultParts: Node[] = [];

  const parseLoop = (): Result<SlottedBody, TemplateError> => {
    const peekedR = peekToken(parserContext);
    if (isErr(peekedR)) {
      return peekedR;
    }
    const peeked = peekedR.value;
    if (isTerminatorSymbol(peeked, endTag)) {
      return ok({ defaultParts, namedSlots, implicitSlots });
    }
    if (isSlotSymbol(peeked)) {
      const slotR = parseSlotBlock(parserContext);
      if (isErr(slotR)) {
        return slotR;
      }
      categorizeSlot(slotR.value, namedSlots, implicitSlots);
      return parseLoop();
    }
    const chunkR = parseUntilBlocks(parserContext, 'slot', endTag);
    if (isErr(chunkR)) {
      return chunkR;
    }
    appendDefaultChunk(defaultParts, chunkR.value);
    return parseLoop();
  };

  return parseLoop();
};

export const buildDefaultBody = (parts: Node[], origin: Loc): Node => {
  if (parts.length === 0) {
    return output(origin, [templateData(origin, '')]);
  }
  if (parts.length === 1) {
    const first = parts[0];
    if (first) {
      return first;
    }
    return output(origin, [templateData(origin, '')]);
  }
  return nodeList(origin, parts);
};

export const advanceAfterTags = (
  parserContext: ParserContext,
  tag: string
): Result<void, TemplateError> => {
  skipSymbol(parserContext, tag);
  const advanceResult = advanceAfterBlockEnd(parserContext, tag);
  if (isErr(advanceResult)) {
    return advanceResult;
  }
  return ok(undefined);
};
