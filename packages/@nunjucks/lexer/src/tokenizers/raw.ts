import { WHITESPACE_CHAR_SET } from '../constants.ts';
import { advance, getChar, isFinished, matches } from '../state.ts';
import { TOKEN_RAW } from '../token-types.ts';
import { createToken } from '../tokens.ts';
import type { LexerState, Tokenizer } from '../types.ts';

type RawScanState = {
  content: string;
  depth: number;
  current: LexerState;
  endStripRight: boolean;
};

interface RawTagOptions {
  readonly tags: {
    blockStart: string;
    blockEnd: string;
    stripBlockStart: string;
    stripBlockEnd: string;
  };
}

const skipWhitespace = (state: LexerState): LexerState => {
  // WHY: while loop instead of per-character recursion. Loop exemption: lexer/tokenizer
  // engine. Covers the full whitespace family (tabs/newlines) so `{%\traw %}` and
  // `{% raw\n%}` lex like upstream's `\s*` tag syntax.
  let current = state;
  while (!isFinished(current) && WHITESPACE_CHAR_SET.has(getChar(current) ?? '')) {
    current = advance(current);
  }
  return current;
};

const shouldContinueTagName = (current: LexerState): boolean => {
  const char = getChar(current);
  return (
    !isFinished(current) && !WHITESPACE_CHAR_SET.has(char ?? '') && char !== '%' && char !== '}'
  );
};

const extractTagName = (state: LexerState): { name: string; current: LexerState } => {
  // WHY: while loop instead of per-character recursion. Loop exemption: lexer/tokenizer
  // engine.
  let current = state;
  let name = '';
  while (shouldContinueTagName(current)) {
    name += getChar(current);
    current = advance(current);
  }
  return { name, current };
};

interface BlockTagStart {
  readonly afterStart: LexerState;
  readonly stripLeft: boolean;
}

// WHY: a raw control tag opens with the plain blockStart or its strip variant
// (`{%-`), mirroring the block-start tokenizer's strip-first matching; the returned
// state sits just past the opening delimiter (dash included when present).
const readBlockTagStart = (state: LexerState, tags: RawTagOptions['tags']): BlockTagStart => {
  if (matches(state, tags.stripBlockStart)) {
    return { afterStart: advance(state, tags.stripBlockStart.length), stripLeft: true };
  }
  return { afterStart: advance(state, tags.blockStart.length), stripLeft: false };
};

interface BlockTagEnd {
  readonly afterEnd: LexerState;
  readonly stripRight: boolean;
}

// WHY: scans forward for the tag's closing delimiter, preferring the strip variant
// (`-%}`) over the plain blockEnd exactly like the block-end tokenizer, so
// `{% raw -%}` is recognized as ONE strip close rather than `-` + `%}`; `null` when
// no closing delimiter exists (the candidate then stays literal content).
const findBlockEnd = (state: LexerState, tags: RawTagOptions['tags']): BlockTagEnd | null => {
  // WHY: while loop instead of the previous per-character recursion — deep raw-block
  // scans overflowed the native stack. Loop exemption: lexer/tokenizer engine.
  let current = state;
  while (!isFinished(current)) {
    if (matches(current, tags.stripBlockEnd)) {
      return { afterEnd: advance(current, tags.stripBlockEnd.length), stripRight: true };
    }
    if (matches(current, tags.blockEnd)) {
      return { afterEnd: advance(current, tags.blockEnd.length), stripRight: false };
    }
    current = advance(current);
  }
  return null;
};

const sliceSource = (from: LexerState, to: LexerState): string =>
  from.source.slice(from.index, to.index);

interface ProcessRawContentOptions {
  current: LexerState;
  name: string;
  endTagName: string;
  tags: RawTagOptions['tags'];
}

interface InnerControlTag {
  readonly tagText: string;
  readonly afterTag: LexerState;
  readonly isEndTag: boolean;
  readonly stripLeft: boolean;
  readonly stripRight: boolean;
}

interface InnerControlTagInput {
  readonly state: LexerState;
  readonly name: string;
  readonly endTagName: string;
  readonly tags: RawTagOptions['tags'];
}

// WHY: reads the tag that starts at `state` (already known to sit on blockStart or its
// strip variant) and decides whether it is a well-formed raw control tag — a nested
// open (raw/verbatim) or the matching close (endraw/endverbatim). Returns null for
// anything else so the caller keeps the `{%` as literal content.
const readInnerControlTag = ({
  state,
  name,
  endTagName,
  tags,
}: InnerControlTagInput): InnerControlTag | null => {
  const { afterStart, stripLeft } = readBlockTagStart(state, tags);
  const afterInnerName = skipWhitespace(afterStart);
  const { name: innerName, current: afterTagName } = extractTagName(afterInnerName);
  if (innerName !== name && innerName !== endTagName) {
    return null;
  }
  const blockEnd = findBlockEnd(afterTagName, tags);
  if (blockEnd === null) {
    return null;
  }
  return {
    tagText: sliceSource(state, blockEnd.afterEnd),
    afterTag: blockEnd.afterEnd,
    isEndTag: innerName === endTagName,
    stripLeft,
    stripRight: blockEnd.stripRight,
  };
};

// WHY: end-tag detection MUST read the tag name BETWEEN blockStart and blockEnd of the
// candidate tag (`{% endraw %}`), not after its closing delimiter. The previous
// implementation matched only the trailing `%}` and then read the name that FOLLOWED it,
// so `{% endraw %}` never terminated a block — the scan always ran to end-of-input and
// raw blocks only "worked" when the close tag sat at the very end of the template.
const processRawContent = ({
  current,
  name,
  endTagName,
  tags,
}: ProcessRawContentOptions): RawScanState => {
  // WHY: while loop instead of the previous per-character recursion — a single large raw
  // body overflowed the native stack. Loop exemption: lexer/tokenizer engine.
  let scanState = current;
  let content = '';
  let depth = 1;
  while (!isFinished(scanState)) {
    const innerTag = matches(scanState, tags.blockStart)
      ? readInnerControlTag({ state: scanState, name, endTagName, tags })
      : null;
    if (innerTag === null) {
      content += getChar(scanState);
      scanState = advance(scanState);
      continue;
    }
    if (innerTag.isEndTag && depth === 1) {
      return {
        content: content + innerTag.tagText,
        depth: 0,
        current: innerTag.afterTag,
        endStripRight: innerTag.stripRight,
      };
    }
    content += innerTag.tagText;
    depth += innerTag.isEndTag ? -1 : 1;
    scanState = innerTag.afterTag;
  }
  return { content, depth, current: scanState, endStripRight: false };
};

/**
 * Tokenizes `{% raw %}`/`{% verbatim %}` blocks whose content is kept verbatim,
 * tracking nested open/close control tags by depth; the value reproduces the original
 * source text, and an unterminated block consumes the remainder without throwing.
 * Strip variants (`{%- raw`, `raw -%}`, `{%- endraw`, `endraw -%}`) are recognized,
 * flagging `stripLeft`/`stripRight` from the outermost open/close tags.
 */
export const tokenizeRaw: Tokenizer = (state) => {
  if (!matches(state, state.tags.blockStart)) {
    return null;
  }

  const { afterStart, stripLeft: openStripLeft } = readBlockTagStart(state, state.tags);
  const afterInnerName = skipWhitespace(afterStart);
  const { name, current: afterName } = extractTagName(afterInnerName);

  if (name !== 'raw' && name !== 'verbatim') {
    return null;
  }

  const endTagName = name === 'raw' ? 'endraw' : 'endverbatim';
  const openTagEnd = findBlockEnd(afterName, state.tags);
  // WHY: the token value reproduces the ORIGINAL opening tag text so the parser's strip
  // regexes (RAW_OPEN_TAG_RE / RAW_CLOSE_TAG_RE) stay symmetric — content is sliced from
  // source, never reconstructed from parts.
  const openTagText =
    openTagEnd !== null ? sliceSource(state, openTagEnd.afterEnd) : sliceSource(state, afterName);
  const scanStart = openTagEnd !== null ? openTagEnd.afterEnd : afterName;
  const {
    content,
    current: finalState,
    endStripRight,
  } = processRawContent({
    current: scanStart,
    name,
    endTagName,
    tags: state.tags,
  });

  return {
    token: createToken({
      type: TOKEN_RAW,
      value: openTagText + content,
      lineno: state.lineno,
      colno: state.colno,
      strip: { stripLeft: openStripLeft, stripRight: endStripRight },
    }),
    state: finalState,
  };
};
