import { advance, getChar, isFinished, matches } from '../state.ts';
import { WHITESPACE_CHARS } from '../constants.ts';
import { TOKEN_RAW } from '../token-types.ts';
import { createToken } from '../tokens.ts';
import type { LexerState, Tokenizer } from '../types.ts';

type RawScanState = {
  content: string;
  depth: number;
  current: LexerState;
};

interface RawTagOptions {
  readonly tags: { blockStart: string; blockEnd: string };
}

const skipWhitespace = (state: LexerState): LexerState => {
  // WHY: while loop instead of per-character recursion. Loop exemption: lexer/tokenizer
  // engine, per ARCHITECTURE.md. Covers the full whitespace family (tabs/newlines) so
  // `{%\traw %}` and `{% raw\n%}` lex like upstream's `\s*` tag syntax.
  let current = state;
  while (!isFinished(current) && WHITESPACE_CHARS.includes(getChar(current))) {
    current = advance(current);
  }
  return current;
};

const shouldContinueTagName = (current: LexerState): boolean => {
  const char = getChar(current);
  return !isFinished(current) && !WHITESPACE_CHARS.includes(char) && char !== '%' && char !== '}';
};

const extractTagName = (state: LexerState): { name: string; current: LexerState } => {
  // WHY: while loop instead of per-character recursion. Loop exemption: lexer/tokenizer
  // engine, per ARCHITECTURE.md.
  let current = state;
  let name = '';
  while (shouldContinueTagName(current)) {
    name += getChar(current);
    current = advance(current);
  }
  return { name, current };
};

// WHY: scans forward for the next blockEnd and returns the position AFTER it — a raw
// control tag ({% raw %} / {% endraw %}) is only well-formed when its closing delimiter
// exists; without it the candidate is treated as literal content.
const findBlockEnd = (state: LexerState, tags: RawTagOptions['tags']): LexerState | null => {
  // WHY: while loop instead of per-character recursion — deep raw-block scans overflowed
  // the native stack. Loop exemption: lexer/tokenizer engine, per ARCHITECTURE.md.
  let current = state;
  while (!isFinished(current)) {
    if (matches(current, tags.blockEnd)) {
      return advance(current, tags.blockEnd.length);
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
  tags: { blockStart: string; blockEnd: string };
}

interface InnerControlTag {
  readonly tagText: string;
  readonly afterTag: LexerState;
  readonly isEndTag: boolean;
}

interface InnerControlTagInput {
  readonly state: LexerState;
  readonly name: string;
  readonly endTagName: string;
  readonly tags: RawTagOptions['tags'];
}

// WHY: reads the tag that starts at `state` (already known to sit on blockStart) and
// decides whether it is a well-formed raw control tag — a nested open (raw/verbatim)
// or the matching close (endraw/endverbatim). Returns null for anything else so the
// caller keeps the `{%` as literal content.
const readInnerControlTag = ({
  state,
  name,
  endTagName,
  tags,
}: InnerControlTagInput): InnerControlTag | null => {
  const afterInnerName = skipWhitespace(advance(state, tags.blockStart.length));
  const { name: innerName, current: afterTagName } = extractTagName(afterInnerName);
  if (innerName !== name && innerName !== endTagName) {
    return null;
  }
  const afterBlockEnd = findBlockEnd(afterTagName, tags);
  if (afterBlockEnd === null) {
    return null;
  }
  return {
    tagText: sliceSource(state, afterBlockEnd),
    afterTag: afterBlockEnd,
    isEndTag: innerName === endTagName,
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
  // body overflowed the native stack. Loop exemption: lexer/tokenizer engine, per
  // ARCHITECTURE.md.
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
      return { content: content + innerTag.tagText, depth: 0, current: innerTag.afterTag };
    }
    content += innerTag.tagText;
    depth += innerTag.isEndTag ? -1 : 1;
    scanState = innerTag.afterTag;
  }
  return { content, depth, current: scanState };
};

/**
 * Tokenizes `{% raw %}`/`{% verbatim %}` blocks whose content is kept verbatim,
 * tracking nested open/close control tags by depth; the value reproduces the original
 * source text, and an unterminated block consumes the remainder without throwing.
 */
export const tokenizeRaw: Tokenizer = (state) => {
  if (!matches(state, state.tags.blockStart)) {
    return null;
  }

  const afterBlockStart = skipWhitespace(advance(state, state.tags.blockStart.length));
  const { name, current: afterName } = extractTagName(afterBlockStart);

  if (name !== 'raw' && name !== 'verbatim') {
    return null;
  }

  const endTagName = name === 'raw' ? 'endraw' : 'endverbatim';
  const openTagEnd = findBlockEnd(afterName, state.tags);
  // WHY: the token value reproduces the ORIGINAL opening tag text so the parser's strip
  // regexes (RAW_OPEN_TAG_RE / RAW_CLOSE_TAG_RE) stay symmetric — content is sliced from
  // source, never reconstructed from parts.
  const openTagText =
    openTagEnd !== null ? sliceSource(state, openTagEnd) : sliceSource(state, afterName);
  const scanStart = openTagEnd ?? afterName;
  const { content, current: finalState } = processRawContent({
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
    }),
    state: finalState,
  };
};
