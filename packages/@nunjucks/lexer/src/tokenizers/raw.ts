import type { Tokenizer } from '../types.ts';
import { getChar, matches, advance, isFinished } from '../state.ts';
import { createToken } from '../tokens.ts';
import type { TokenType } from '../token-types.ts';

type RawState = {
  content: string;
  depth: number;
  current: ReturnType<typeof advance>;
};

const skipWhitespaceAfterBlockStart = (state: ReturnType<typeof advance>): ReturnType<typeof advance> => {
  let current = state;
  while (!isFinished(current) && getChar(current) === ' ') {
    current = advance(current);
  }
  return current;
};

const extractTagName = (state: ReturnType<typeof advance>): { name: string; current: ReturnType<typeof advance> } => {
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

const extractTagNameAfterBlockEnd = (beforeEnd: ReturnType<typeof advance>): { tagName: string; current: ReturnType<typeof advance> } => {
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
  current: ReturnType<typeof advance>,
  name: string,
  endTagName: string,
  depth: number,
  tags: { BLOCK_START: string; BLOCK_END: string }
): RawState | null => {
  const afterBlockEnd = advance(current, tags.BLOCK_END.length);
  const { tagName } = extractTagNameAfterBlockEnd(afterBlockEnd);

  if (tagName === name) {
    return {
      content: tags.BLOCK_END + tagName,
      depth: depth + 1,
      current: afterBlockEnd,
    };
  }

  if (tagName === endTagName) {
    if (depth === 1) {
      return {
        content: tags.BLOCK_END + endTagName + tags.BLOCK_END,
        depth: 0,
        current: advance(afterBlockEnd, tags.BLOCK_END.length),
      };
    }
    return {
      content: tags.BLOCK_END + tagName,
      depth: depth - 1,
      current: afterBlockEnd,
    };
  }

  return null;
};

const processRawContent = (
  current: ReturnType<typeof advance>,
  name: string,
  endTagName: string,
  tags: { BLOCK_START: string; BLOCK_END: string }
): RawState => {
  let content = tags.BLOCK_START + name;
  let depth = 1;
  let state = current;

  while (!isFinished(state) && depth > 0) {
    if (matches(state, tags.BLOCK_END)) {
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
  if (!matches(state, state.tags.BLOCK_START)) { return null; }

  const blockStartLen = state.tags.BLOCK_START.length;
  let current = advance(state, blockStartLen);

  current = skipWhitespaceAfterBlockStart(current);
  const { name, current: afterName } = extractTagName(current);

  if (name !== 'raw' && name !== 'verbatim') { return null; }

  const endTagName = getEndTagName(name);
  const { content, current: finalState } = processRawContent(afterName, name, endTagName, state.tags);

  return {
    token: createToken('raw' as TokenType, content, state.lineno, state.colno),
    state: finalState,
  };
};
