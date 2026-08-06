import type { LexerState, LexerOptions } from './types.ts';
import { createDelimiters } from './delimiters.ts';

export const createState = (str: string, opts: LexerOptions = {}): LexerState => ({
  str,
  index: 0,
  lineno: 0,
  colno: 0,
  inCode: false,
  tags: createDelimiters(opts.tags),
  trimBlocks: Boolean(opts.trimBlocks),
  lstripBlocks: Boolean(opts.lstripBlocks),
});

export const getChar = (state: LexerState): string => {
  if (state.index < state.str.length) {
    const char = state.str[state.index];
    return char ?? '';
  }
  return '';
};

export const getPeek = (state: LexerState): string => {
  if (state.index + 1 < state.str.length) {
    const char = state.str[state.index + 1];
    return char ?? '';
  }
  return '';
};

export const isFinished = (state: LexerState): boolean =>
  state.index >= state.str.length;

export const advance = (state: LexerState, n = 1): LexerState => {
  const { str, index, lineno, colno } = state;
  const newIndex = Math.min(index + n, str.length);
  if (newIndex === index) {
    return state;
  }

  let newLineno = lineno;
  let newColno = colno;
  for (let i = index; i < newIndex; i++) {
    if (str[i] === '\n') {
      newLineno++;
      newColno = 0;
    } else {
      newColno++;
    }
  }

  return { ...state, index: newIndex, lineno: newLineno, colno: newColno };
};

export const matches = (state: LexerState, text: string): boolean => {
  const { index, str } = state;
  const textLen = text.length;
  if (index + textLen > str.length) { return false; }
  return str.slice(index, index + textLen) === text;
};
