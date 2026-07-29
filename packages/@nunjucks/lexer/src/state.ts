import type { LexerState, LexerOptions } from './types.ts';
import { createDelimiters } from './delimiters.ts';
import { reduce, pipe } from 'remeda';

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

  const stepped = pipe(
    Array.from(str.slice(index, newIndex)),
    reduce(
      (acc, ch) =>
        ch === '\n'
          ? { lineno: acc.lineno + 1, colno: 0 }
          : { lineno: acc.lineno, colno: acc.colno + 1 },
      { lineno, colno }
    )
  );

  return { ...state, index: newIndex, lineno: stepped.lineno, colno: stepped.colno };
};

export const matches = (state: LexerState, text: string): boolean => {
  const { index, str } = state;
  const textLen = text.length;
  if (index + textLen > str.length) { return false; }
  return str.slice(index, index + textLen) === text;
};
