// Shared parsing for `{% slot %}` blocks used by both component definitions
// (fallback slots) and render invocations (provided slots).
import type { Node, SlotBlock } from '@nunjucks/nodes';
import { nodeList, output, templateData } from '@nunjucks/nodes';
import {
  TOKEN_LEFT_PAREN, TOKEN_RIGHT_PAREN, TOKEN_COMMA,
  isSymbolToken,
} from '@nunjucks/lexer';
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
  /** Content outside any `{% slot %}` block — definition markup (component) or provided default (render). */
  defaultParts: Node[];
  /** Named `{% slot name %}` blocks, hoisted out of the body. */
  namedSlots: SlotBlock[];
  /** Unnamed `{% slot %}` blocks — default-slot declarations, kept separate so component/render interpret them differently. */
  implicitSlots: SlotBlock[];
}

const parseSlotBlock = (ctx: ParserContext): ParsedSlot => {
  skipSymbol(ctx, 'slot');

  const nameTok = nextTokenOrNull(ctx);
  const name = nameTok && isSymbolToken(nameTok) ? nameTok.value : 'default';

  const params: string[] = [];
  const afterName = peekToken(ctx);
  if (afterName.type === TOKEN_LEFT_PAREN) {
    nextToken(ctx);
    while (true) {
      const inner = nextTokenOrNull(ctx);
      if (!inner || inner.type === TOKEN_RIGHT_PAREN) { break; }
      if (inner.type === TOKEN_COMMA) { continue; }
      if (isSymbolToken(inner)) {
        params.push(inner.value);
      }
    }
  }

  advanceAfterBlockEnd(ctx, 'slot');
  const body = parseUntilBlocks(ctx, 'endslot');
  skipSymbol(ctx, 'endslot');
  advanceAfterBlockEnd(ctx, 'endslot');

  return { name, params, body };
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: body splitting has natural branching
export const parseSlottedBody = (ctx: ParserContext, endTag: string): SlottedBody => {
  const namedSlots: SlotBlock[] = [];
  const implicitSlots: SlotBlock[] = [];
  const defaultParts: Node[] = [];

  while (true) {
    const peeked = peekToken(ctx);
    if (isSymbolToken(peeked)) {
      const val = peeked.value;
      if (val === endTag) { break; }
      if (val === 'slot') {
        const parsed = parseSlotBlock(ctx);
        if (parsed.name === 'default') {
          // Unnamed `{% slot %}` block — the default-slot declaration
          implicitSlots.push(parsed);
        } else {
          namedSlots.push(parsed);
        }
        continue;
      }
    }

    const chunk = parseUntilBlocks(ctx, 'slot', endTag);
    if ((chunk.children?.length ?? 0) > 0) {
      defaultParts.push(chunk);
    }
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
  return nodeList(lineno, colno, parts as Node[]);
};

export const advanceAfterTags = (ctx: ParserContext, tag: string): void => {
  skipSymbol(ctx, tag);
  advanceAfterBlockEnd(ctx, tag);
};