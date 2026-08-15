import { advance, getChar, isFinished, matches } from '../state.ts';
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

const skipSpaces = (state: LexerState): LexerState => {
  if (isFinished(state) || getChar(state) !== ' ') {
    return state;
  }
  return skipSpaces(advance(state));
};

const extractTagName = (state: LexerState): { name: string; current: LexerState } => {
  const scan = (
    current: LexerState,
    name: string
  ): { name: string; current: LexerState } => {
    const char = getChar(current);
    if (isFinished(current) || char === ' ' || char === '%' || char === '}') {
      return { name, current };
    }
    return scan(advance(current), name + char);
  };
  return scan(state, '');
};

// WHY: scans forward for the next blockEnd and returns the position AFTER it — a raw
// control tag ({% raw %} / {% endraw %}) is only well-formed when its closing delimiter
// exists; without it the candidate is treated as literal content.
const findBlockEnd = (state: LexerState, tags: RawTagOptions['tags']): LexerState | null => {
  const scan = (current: LexerState): LexerState | null => {
    if (isFinished(current)) {
      return null;
    }
    if (matches(current, tags.blockEnd)) {
      return advance(current, tags.blockEnd.length);
    }
    return scan(advance(current));
  };
  return scan(state);
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

// WHY: reads the tag that starts at `state` (already known to sit on blockStart) and
// decides whether it is a well-formed raw control tag — a nested open (raw/verbatim)
// or the matching close (endraw/endverbatim). Returns null for anything else so the
// caller keeps the `{%` as literal content.
const readInnerControlTag = (
  state: LexerState,
  name: string,
  endTagName: string,
  tags: RawTagOptions['tags']
): InnerControlTag | null => {
  const afterInnerName = skipSpaces(advance(state, tags.blockStart.length));
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
  const scan = (state: LexerState, content: string, depth: number): RawScanState => {
    if (isFinished(state)) {
      return { content, depth, current: state };
    }
    const innerTag = matches(state, tags.blockStart)
      ? readInnerControlTag(state, name, endTagName, tags)
      : null;
    if (innerTag === null) {
      return scan(advance(state), content + getChar(state), depth);
    }
    if (innerTag.isEndTag && depth === 1) {
      return { content: content + innerTag.tagText, depth: 0, current: innerTag.afterTag };
    }
    const nextDepth = depth + (innerTag.isEndTag ? -1 : 1);
    return scan(innerTag.afterTag, content + innerTag.tagText, nextDepth);
  };
  return scan(current, '', 1);
};

export const tokenizeRaw: Tokenizer = (state) => {
  if (!matches(state, state.tags.blockStart)) {
    return null;
  }

  const afterBlockStart = skipSpaces(advance(state, state.tags.blockStart.length));
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
