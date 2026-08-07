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
  let current = state;
  while (!isFinished(current) && getChar(current) === ' ') {
    current = advance(current);
  }
  return current;
};

const extractTagName = (state: LexerState): { name: string; current: LexerState } => {
  let name = '';
  let current = state;
  while (!isFinished(current) && getChar(current) !== ' ' && getChar(current) !== '%' && getChar(current) !== '}') {
    name += getChar(current);
    current = advance(current);
  }
  return { name, current };
};

const getEndTagName = (name: string): string => (name === 'raw' ? 'endraw' : 'endverbatim');

const isWhitespaceChar = (char: string): boolean =>
  char === ' ' || char === '\n' || char === '\t' || char === '\r';

const extractTagNameAfterBlockEnd = (beforeEnd: LexerState): { tagName: string; current: LexerState } => {
  let tagName = '';
  let current = beforeEnd;
  while (!isFinished(current) && getChar(current) !== '%' && getChar(current) !== '}') {
    if (isWhitespaceChar(getChar(current))) {
      break;
    }
    tagName += getChar(current);
    current = advance(current);
  }
  return { tagName, current };
};

const processBlockEndTag = (
  current: LexerState,
  name: string,
  endTagName: string,
  depth: number,
  tags: { blockStart: string; blockEnd: string }
): RawState | null => {
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

const processRawContent = (
  current: LexerState,
  name: string,
  endTagName: string,
  tags: { blockStart: string; blockEnd: string }
): RawState => {
  let content = tags.blockStart + name;
  let depth = 1;
  let state = current;

  while (!isFinished(state) && depth > 0) {
    if (matches(state, tags.blockEnd)) {
      const result = processBlockEndTag(state, name, endTagName, depth, tags);
      if (result === null) {
        content += getChar(state);
        state = advance(state);
      } else {
        content += result.content;
        depth = result.depth;
        state = result.current;
      }
    } else {
      content += getChar(state);
      state = advance(state);
    }
  }

  return { content, depth, current: state };
};

export const tokenizeRaw: Tokenizer = (state) => {
  if (!matches(state, state.tags.blockStart)) { return null; }

  const blockStartLen = state.tags.blockStart.length;
  let current = advance(state, blockStartLen);

  current = skipWhitespaceAfterBlockStart(current);
  const { name, current: afterName } = extractTagName(current);

  if (name !== 'raw' && name !== 'verbatim') { return null; }

  const endTagName = getEndTagName(name);
  const { content, current: finalState } = processRawContent(afterName, name, endTagName, state.tags);

  return {
    token: createToken(TOKEN_RAW, content, state.lineno, state.colno),
    state: finalState,
  };
};
