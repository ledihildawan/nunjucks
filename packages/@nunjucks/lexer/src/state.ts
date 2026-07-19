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
  let { index, lineno, colno } = state;
  for (let i = 0; i < n && index < state.str.length; i++) {
    const prev = index > 0 ? state.str[index - 1] : '';
    if (prev === '\n') {
      lineno++;
      colno = 0;
    } else {
      colno++;
    }
    index++;
  }
  return { ...state, index, lineno, colno };
};

export const matches = (state: LexerState, text: string): boolean =>
  state.str.slice(state.index, state.index + text.length) === text;
