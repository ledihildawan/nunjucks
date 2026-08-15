import { advance, getChar, matches } from '../state.ts';
import { TOKEN_DATA } from '../token-types.ts';
import { createToken } from '../tokens.ts';
import type { LexerState, Tokenizer } from '../types.ts';
import { tokenizeBlockStart } from './block.ts';

// WHY: lstripBlocks strips ONLY line-leading whitespace before a BLOCK tag ({% ... %}),
// never before {{ }} or {# #}. The last line of the data must be whitespace-only —
// a tag at column 0 or content on its line keeps the text untouched.
const LINE_LEADING_WS_RE = /^[ \t\r]+$/;

const applyLstripBlocks = (text: string, state: LexerState, current: LexerState): string => {
  if (!state.lstripBlocks || !matches(current, state.tags.blockStart)) {
    return text;
  }
  const lastLineStart = text.lastIndexOf('\n') + 1;
  const lastLine = text.slice(lastLineStart);
  return LINE_LEADING_WS_RE.test(lastLine) ? text.slice(0, lastLineStart) : text;
};

export const tokenizeTemplateText: Tokenizer = (state) => {
  if (state.inCode) {
    return null;
  }

  const { lineno, colno } = state;
  const scan = (current: LexerState, text: string): { current: LexerState; text: string } => {
    if (current.index >= current.source.length) {
      return { current, text };
    }
    if (
      matches(current, current.tags.blockStart) ||
      matches(current, current.tags.variableStart) ||
      matches(current, current.tags.commentStart)
    ) {
      return { current, text };
    }
    return scan(advance(current), text + getChar(current));
  };
  const { current: endState, text: scanned } = scan(state, '');
  const dataText = applyLstripBlocks(scanned, state, endState);

  if (!dataText) {
    // WHY: lstripBlocks consumed the whole data chunk (pure whitespace before a block
    // tag) — delegate to the block-start tokenizer so no empty data token is emitted.
    return tokenizeBlockStart(endState);
  }
  return {
    token: createToken({ type: TOKEN_DATA, value: dataText, lineno, colno }),
    state: endState,
  };
};
