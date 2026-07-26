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
  const str = state.str;
  let { index, lineno, colno } = state;
  const maxIndex = str.length;
  
  for (let i = 0; i < n && index < maxIndex; i += 1) {
    const prev = str[index];
    index += 1;
    if (prev === '\n') {
      lineno += 1;
      colno = 0;
    } else {
      colno += 1;
    }
  }
  
  if (state.index === index) {
    return state;
  }
  return { ...state, index, lineno, colno };
};

export const matches = (state: LexerState, text: string): boolean => {
  const { index, str } = state;
  const textLen = text.length;
  if (index + textLen > str.length) { return false; }
  
  for (let i = 0; i < textLen; i += 1) {
    if (str[index + i] !== text[i]) { return false; }
  }
  return true;
};
