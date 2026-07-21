import type { Tokenizer } from '../types';
import { getChar, matches, advance, isFinished } from '../state';
import { createToken } from '../tokens';
import type { TokenType } from '../token-types';

export const tokenizeRaw: Tokenizer = (state) => {
  if (!matches(state, state.tags.BLOCK_START)) return null;

  const blockStartLen = state.tags.BLOCK_START.length;
  let current = advance(state, blockStartLen);

  while (!isFinished(current) && getChar(current) === ' ') {
    current = advance(current);
  }

  let name = '';
  while (!isFinished(current) && getChar(current) !== ' ' && getChar(current) !== '%' && getChar(current) !== '}') {
    name += getChar(current);
    current = advance(current);
  }

  if (name !== 'raw' && name !== 'verbatim') return null;

  const endTagName = name === 'raw' ? 'endraw' : 'endverbatim';
  let content = state.tags.BLOCK_START + name;
  let depth = 1;

  while (!isFinished(current) && depth > 0) {
    if (matches(current, state.tags.BLOCK_END)) {
      const afterBlockEnd = advance(current, state.tags.BLOCK_END.length);
      const beforeEnd = advance(current, state.tags.BLOCK_END.length);

      let tagName = '';
      let tagCurrent = beforeEnd;

      while (!isFinished(tagCurrent) && getChar(tagCurrent) !== '%' && getChar(tagCurrent) !== '}') {
        if (getChar(tagCurrent) === ' ' || getChar(tagCurrent) === '\n' || getChar(tagCurrent) === '\t' || getChar(tagCurrent) === '\r') {
          break;
        }
        tagName += getChar(tagCurrent);
        tagCurrent = advance(tagCurrent);
      }

      if (tagName === name) {
        depth++;
        content += state.tags.BLOCK_END + tagName;
        current = afterBlockEnd;
      } else if (tagName === endTagName) {
        depth--;
        if (depth === 0) {
          content += state.tags.BLOCK_END + endTagName + state.tags.BLOCK_END;
          current = advance(afterBlockEnd, state.tags.BLOCK_END.length);
          break;
        } else {
          content += state.tags.BLOCK_END + tagName;
          current = afterBlockEnd;
        }
      } else {
        content += getChar(current);
        current = advance(current);
      }
    } else {
      content += getChar(current);
      current = advance(current);
    }
  }

  return {
    token: createToken('raw' as TokenType, content, state.lineno, state.colno),
    state: current,
  };
};
