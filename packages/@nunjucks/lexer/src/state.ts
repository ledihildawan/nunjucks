import type { LexerState, LexerOptions } from './types.ts';
import { createDelimiters } from './delimiters.ts';

export const createState = (str: string, options: LexerOptions = {}): LexerState => ({
  str,
  index: 0,
  lineno: 0,
  colno: 0,
  inCode: false,
  tags: createDelimiters(options.tags),
  trimBlocks: Boolean(options.trimBlocks),
  lstripBlocks: Boolean(options.lstripBlocks),
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

export const advance = (state: LexerState, charCount = 1): LexerState => {
  const { str, index, lineno, colno } = state;
  const newIndex = Math.min(index + charCount, str.length);
  if (newIndex === index) {
    return state;
  }

  const countLines = (i: number, lineNum: number, colNum: number): { lineno: number; colno: number } => {
    if (i >= newIndex) { return { lineno: lineNum, colno: colNum }; }
    if (str[i] === '\n') {
      return countLines(i + 1, lineNum + 1, 0);
    }
    return countLines(i + 1, lineNum, colNum + 1);
  };
  const { lineno: newLineno, colno: newColno } = countLines(index, lineno, colno);

  return { ...state, index: newIndex, lineno: newLineno, colno: newColno };
};

export const matches = (state: LexerState, text: string): boolean => {
  const { index, str } = state;
  const textLen = text.length;
  if (index + textLen > str.length) { return false; }
  return str.slice(index, index + textLen) === text;
};
