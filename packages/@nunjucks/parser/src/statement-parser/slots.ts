import type { Node, SlotBlock } from '@nunjucks/nodes';
import { nodeList, output, templateData } from '@nunjucks/nodes';
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

const parseSlotBlock = (parserContext: ParserContext): ParsedSlot => {
  skipSymbol(parserContext, 'slot');

  const nameTok = nextTokenOrNull(parserContext);
  const name = nameTok && isSymbolToken(nameTok) ? nameTok.value : 'default';

  const params: string[] = [];
  const afterName = peekToken(parserContext);
  if (afterName.type === TOKEN_LEFT_PAREN) {
    nextToken(parserContext);
    while (true) {
      const inner = nextTokenOrNull(parserContext);
      if (!inner || inner.type === TOKEN_RIGHT_PAREN) { break; }
      if (inner.type === TOKEN_COMMA) { continue; }
      if (isSymbolToken(inner)) {
        params.push(inner.value);
      }
    }
  }

  advanceAfterBlockEnd(parserContext, 'slot');
  const body = parseUntilBlocks(parserContext, 'endslot');
  skipSymbol(parserContext, 'endslot');
  advanceAfterBlockEnd(parserContext, 'endslot');

  return { name, params, body };
};

const appendDefaultChunk = (defaultParts: Node[], chunk: Node): void => {
  if ((chunk.children?.length ?? 0) > 0) {
    defaultParts.push(chunk);
  }
};

export const parseSlottedBody = (parserContext: ParserContext, endTag: string): SlottedBody => {
  const namedSlots: SlotBlock[] = [];
  const implicitSlots: SlotBlock[] = [];
  const defaultParts: Node[] = [];

  while (true) {
    const peeked = peekToken(parserContext);
    if (isTerminatorSymbol(peeked, endTag)) { break; }
    if (isSlotSymbol(peeked)) {
      categorizeSlot(parseSlotBlock(parserContext), namedSlots, implicitSlots);
      continue;
    }
    appendDefaultChunk(defaultParts, parseUntilBlocks(parserContext, 'slot', endTag));
  }

  return { defaultParts, namedSlots, implicitSlots };
};

export const buildDefaultBody = (parts: Node[], lineno: number, colno: number): Node => {
  if (parts.length === 0) {
    return output(lineno, colno, [templateData(lineno, colno, '')]);
  }
  if (parts.length === 1) {
    return parts[0] as Node;
  }
  return nodeList(lineno, colno, parts);
};

export const advanceAfterTags = (parserContext: ParserContext, tag: string): void => {
  skipSymbol(parserContext, tag);
  advanceAfterBlockEnd(parserContext, tag);
};