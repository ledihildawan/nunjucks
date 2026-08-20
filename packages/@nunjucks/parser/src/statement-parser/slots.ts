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
  fail,
  nextToken,
  nextTokenOrNull,
  peekToken,
  skipSymbol,
} from '../cursor.ts';

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

const parseSlotParams = (parserContext: ParserContext): Result<string[], TemplateError> => {
  // WHY: iterative loop (parser loop exemption) — the recursive collect recursed once
  // per param/comma token, so pathological slot param lists overflowed the stack.
  const params: string[] = [];
  while (true) {
    const inner = nextTokenOrNull(parserContext);
    if (!inner || inner.type === TOKEN_RIGHT_PAREN) {
      return ok(params);
    }
    if (inner.type === TOKEN_COMMA) {
      continue;
    }
    if (isSymbolToken(inner)) {
      params.push(inner.value);
      continue;
    }
    // WHY: fail loudly — the previous silent skip swallowed typos like
    // `{% slot x(123) %}` into a slot whose params disagreed with its source.
    return fail(parserContext, {
      message: `unexpected token in slot params: ${inner.type}`,
      lineno: inner.lineno,
      colno: inner.colno,
    });
  }
};

const parseSlotBlock = (parserContext: ParserContext): Result<ParsedSlot, TemplateError> => {
  skipSymbol(parserContext, 'slot');

  // WHY: peek-then-consume — an unconditional nextTokenOrNull would eat the block-end
  // of the anonymous form `{% slot %}`, making advanceAfterBlockEnd fail below. Only a
  // real symbol is a slot name; anything else means the documented `default` fallback.
  const peekedNameR = peekToken(parserContext);
  if (isErr(peekedNameR)) {
    return peekedNameR;
  }
  const peekedName = peekedNameR.value;
  let name = 'default';
  if (isSymbolToken(peekedName)) {
    const consumedNameR = nextToken(parserContext);
    if (isErr(consumedNameR)) {
      return consumedNameR;
    }
    if (isSymbolToken(consumedNameR.value)) {
      name = consumedNameR.value.value;
    }
  }

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
    const paramsR = parseSlotParams(parserContext);
    if (isErr(paramsR)) {
      return paramsR;
    }
    params.push(...paramsR.value);
  }

  const blockEndR = advanceAfterBlockEnd(parserContext, 'slot');
  if (isErr(blockEndR)) {
    return blockEndR;
  }
  const bodyR = parserContext.parseUntilBlocks('endslot');
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

/**
 * Parses a slotted body up to `endTag`: explicit `{% slot name(params) %}`
 * blocks are split into named and implicit `default` slots while the
 * surrounding chunks accumulate as default-slot content.
 */
export const parseSlottedBody = (
  parserContext: ParserContext,
  endTag: string
): Result<SlottedBody, TemplateError> => {
  const namedSlots: SlotBlock[] = [];
  const implicitSlots: SlotBlock[] = [];
  const defaultParts: Node[] = [];

  // WHY: iterative loop (parser loop exemption) — the recursive parseLoop recursed
  // once per slot/chunk segment, so slotted bodies with many segments relied on
  // engine tail-calls and overflowed the stack where those are unavailable.
  while (true) {
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
      continue;
    }
    const chunkR = parserContext.parseUntilBlocks('slot', endTag);
    if (isErr(chunkR)) {
      return chunkR;
    }
    appendDefaultChunk(defaultParts, chunkR.value);
  }
};

/** Combines default-slot chunks into one body node, using empty output when there are none. */
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

/** Consumes the `endTag` symbol and its block end, e.g. `endcomponent %}`. */
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
