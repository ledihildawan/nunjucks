import type { LexerState, LexerOptions } from './types';
import { createDelimiters } from './delimiters';

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

export const getChar = (state: LexerState): string =>
  state.index < state.str.length ? (state.str[state.index] ?? '') : '';

export const getPeek = (state: LexerState): string =>
  state.index + 1 < state.str.length ? (state.str[state.index + 1] ?? '') : '';

export const isFinished = (state: LexerState): boolean =>
  state.index >= state.str.length;

export const advance = (state: LexerState, n: number = 1): LexerState => {
  const str = state.str;
  let { index, lineno, colno } = state;
  const maxIndex = str.length;
  
  for (let i = 0; i < n && index < maxIndex; i++) {
    const prev = str[index];
    index++;
    if (prev === '\n') {
      lineno++;
      colno = 0;
    } else {
      colno++;
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
  if (index + textLen > str.length) return false;
  
  for (let i = 0; i < textLen; i++) {
    if (str[index + i] !== text[i]) return false;
  }
  return true;
};
