import { createDelimiters } from './delimiters.ts';
import type { LexerOptions, LexerState } from './types.ts';

export const createState = (source: string, options: LexerOptions = {}): LexerState => ({
  source,
  index: 0,
  lineno: 0,
  colno: 0,
  inCode: false,
  tags: createDelimiters(options.tags),
  trimBlocks: Boolean(options.trimBlocks),
  lstripBlocks: Boolean(options.lstripBlocks),
});

export const getChar = (state: LexerState): string => {
  if (state.index < state.source.length) {
    const char = state.source[state.index];
    return char ?? '';
  }
  return '';
};

export const getPeek = (state: LexerState): string => {
  if (state.index + 1 < state.source.length) {
    const char = state.source[state.index + 1];
    return char ?? '';
  }
  return '';
};

export const isFinished = (state: LexerState): boolean => state.index >= state.source.length;

export const advance = (state: LexerState, charCount = 1): LexerState => {
  const { source, index, lineno, colno } = state;
  const newIndex = Math.min(index + charCount, source.length);
  if (newIndex === index) {
    return state;
  }

  const countLines = (
    i: number,
    lineNum: number,
    colNum: number
  ): { lineno: number; colno: number } => {
    if (i >= newIndex) {
      return { lineno: lineNum, colno: colNum };
    }
    if (source[i] === '\n') {
      return countLines(i + 1, lineNum + 1, 0);
    }
    return countLines(i + 1, lineNum, colNum + 1);
  };
  const { lineno: newLineno, colno: newColno } = countLines(index, lineno, colno);

  return { ...state, index: newIndex, lineno: newLineno, colno: newColno };
};

export const matches = (state: LexerState, text: string): boolean => {
  const { index, source } = state;
  const textLen = text.length;
  if (index + textLen > source.length) {
    return false;
  }
  return source.slice(index, index + textLen) === text;
};
