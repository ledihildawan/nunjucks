import type { Tokenizer, LexerState } from '../types.ts';
import { getChar, matches, advance, isFinished } from '../state.ts';
import { createToken } from '../tokens.ts';
import { TOKEN_RAW } from '../token-types.ts';

type RawState = {
  content: string;
  depth: number;
  current: LexerState;
};

const skipWhitespaceAfterBlockStart = (state: LexerState): LexerState => {
  const skip = (current: LexerState): LexerState => {
    if (isFinished(current) || getChar(current) !== ' ') { return current; }
    return skip(advance(current));
  };
  return skip(state);
};

const extractTagName = (state: LexerState): { name: string; current: LexerState } => {
  const scan = (current: LexerState, name: string): { name: string; current: LexerState } => {
    const char = getChar(current);
    if (isFinished(current) || char === ' ' || char === '%' || char === '}') {
      return { name, current };
    }
    return scan(advance(current), name + char);
  };
  return scan(state, '');
};

const getEndTagName = (name: string): string => (name === 'raw' ? 'endraw' : 'endverbatim');

const isWhitespaceChar = (char: string): boolean =>
  char === ' ' || char === '\n' || char === '\t' || char === '\r';

const extractTagNameAfterBlockEnd = (beforeEnd: LexerState): { tagName: string; current: LexerState } => {
  const scan = (current: LexerState, tagName: string): { tagName: string; current: LexerState } => {
    const char = getChar(current);
    if (isFinished(current) || char === '%' || char === '}' || isWhitespaceChar(char)) {
      return { tagName, current };
    }
    return scan(advance(current), tagName + char);
  };
  return scan(beforeEnd, '');
};

interface ProcessBlockEndTagOptions {
  current: LexerState;
  name: string;
  endTagName: string;
  depth: number;
  tags: { blockStart: string; blockEnd: string };
}

const processBlockEndTag = ({
  current,
  name,
  endTagName,
  depth,
  tags,
}: ProcessBlockEndTagOptions): RawState | null => {
  const afterBlockEnd = advance(current, tags.blockEnd.length);
  const { tagName } = extractTagNameAfterBlockEnd(afterBlockEnd);

  if (tagName === name) {
    return {
      content: tags.blockEnd + tagName,
      depth: depth + 1,
      current: afterBlockEnd,
    };
  }

  if (tagName === endTagName) {
    if (depth === 1) {
      return {
        content: tags.blockEnd + endTagName + tags.blockEnd,
        depth: 0,
        current: advance(afterBlockEnd, tags.blockEnd.length),
      };
    }
    return {
      content: tags.blockEnd + tagName,
      depth: depth - 1,
      current: afterBlockEnd,
    };
  }

  return null;
};

interface ProcessRawContentOptions {
  current: LexerState;
  name: string;
  endTagName: string;
  tags: { blockStart: string; blockEnd: string };
}

const processRawContent = ({
  current,
  name,
  endTagName,
  tags,
}: ProcessRawContentOptions): RawState => {
  const scan = (state: LexerState, content: string, depth: number): RawState => {
    if (isFinished(state) || depth <= 0) {
      return { content, depth, current: state };
    }
    if (matches(state, tags.blockEnd)) {
      const result = processBlockEndTag({ current: state, name, endTagName, depth, tags });
      if (result === null) {
        return scan(advance(state), content + getChar(state), depth);
      }
      return scan(result.current, content + result.content, result.depth);
    }
    return scan(advance(state), content + getChar(state), depth);
  };
  return scan(current, tags.blockStart + name, 1);
};

export const tokenizeRaw: Tokenizer = (state) => {
  if (!matches(state, state.tags.blockStart)) { return null; }

  const blockStartLen = state.tags.blockStart.length;
  let current = advance(state, blockStartLen);

  current = skipWhitespaceAfterBlockStart(current);
  const { name, current: afterName } = extractTagName(current);

  if (name !== 'raw' && name !== 'verbatim') { return null; }

  const endTagName = getEndTagName(name);
  const { content, current: finalState } = processRawContent({ current: afterName, name, endTagName, tags: state.tags });

  return {
    token: createToken({ type: TOKEN_RAW, value: content, lineno: state.lineno, colno: state.colno }),
    state: finalState,
  };
};
