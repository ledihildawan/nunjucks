import { createDelimiters } from './delimiters.ts';
import type { LexerOptions, LexerState } from './types.ts';

/**
 * Creates the initial `LexerState` at index 0, resolving custom tag delimiters and
 * normalizing `trimBlocks`/`lstripBlocks` to booleans.
 */
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

/** Reads the character at the cursor; returns an empty string at EOF. */
export const getChar = (state: LexerState): string => {
  if (state.index < state.source.length) {
    const char = state.source[state.index];
    return char ?? '';
  }
  return '';
};

/** Reads the character one position ahead of the cursor; empty string at or past EOF. */
export const getPeek = (state: LexerState): string => {
  if (state.index + 1 < state.source.length) {
    const char = state.source[state.index + 1];
    return char ?? '';
  }
  return '';
};

/** Returns `true` when the cursor has reached or passed the end of the source. */
export const isFinished = (state: LexerState): boolean => state.index >= state.source.length;

/**
 * Advances the cursor by `charCount` positions, returning a fresh state with line and
 * column tracking updated across newlines; the index clamps at EOF and a zero-move
 * advance returns the identical state object.
 */
export const advance = (state: LexerState, charCount = 1): LexerState => {
  const { source, index, lineno, colno } = state;
  const newIndex = Math.min(index + charCount, source.length);
  if (newIndex === index) {
    return state;
  }

  // WHY: while loop instead of the previous recursive countLines — a single multi-char
  // advance (long string literal, raw block slice) recursed once per character and
  // overflowed the native stack. Loop exemption: lexer/tokenizer engine, per
  // ARCHITECTURE.md.
  let scanIndex = index;
  let newLineno = lineno;
  let newColno = colno;
  while (scanIndex < newIndex) {
    if (source[scanIndex] === '\n') {
      newLineno += 1;
      newColno = 0;
    } else {
      newColno += 1;
    }
    scanIndex += 1;
  }

  return { ...state, index: newIndex, lineno: newLineno, colno: newColno };
};

/** Tests whether `text` appears verbatim at the cursor; `false` if it would pass EOF. */
export const matches = (state: LexerState, text: string): boolean => {
  const { index, source } = state;
  const textLen = text.length;
  if (index + textLen > source.length) {
    return false;
  }
  return source.slice(index, index + textLen) === text;
};
