import { isDigit } from '../constants.ts';
import { advance } from '../state.ts';
import { createNumberToken } from '../tokens.ts';
import type { LexerState, Tokenizer } from '../types.ts';

const parseDigits = (current: LexerState): { num: string; current: LexerState } => {
  // WHY: while loop instead of per-digit recursion — a long digit run overflowed the
  // native stack. Loop exemption: lexer/tokenizer engine.
  let scanState = current;
  let num = '';
  while (
    scanState.index < scanState.source.length &&
    isDigit(scanState.source[scanState.index] ?? '')
  ) {
    num += scanState.source[scanState.index] ?? '';
    scanState = advance(scanState);
  }
  return { num, current: scanState };
};

const parseDecimalPart = (
  current: LexerState
): { hasDecimal: boolean; num: string; current: LexerState } => {
  if (current.index < current.source.length && (current.source[current.index] ?? '') === '.') {
    const nextChar = current.source[current.index + 1] ?? '';
    if (nextChar === '.') {
      return { hasDecimal: false, num: '', current };
    }
    const afterDot = advance(current);
    const { num: decimalDigits, current: newCurrent } = parseDigits(afterDot);
    const num = `.${decimalDigits}`;
    return { hasDecimal: true, num, current: newCurrent };
  }
  return { hasDecimal: false, num: '', current };
};

const convertToNumber = (num: string, hasDecimal: boolean): number | null => {
  if (!num || num === '.') {
    return null;
  }
  const value = hasDecimal ? Number.parseFloat(num) : Number.parseInt(num, 10);
  return Number.isNaN(value) ? null : value;
};

/**
 * Tokenizes integer and decimal literals, choosing `TOKEN_FLOAT` when a fractional
 * part was consumed; a `.` followed by another `.` (range syntax) is left untouched.
 */
export const tokenizeNumber: Tokenizer = (state) => {
  const { lineno, colno } = state;
  const { num: intPart, current } = parseDigits(state);
  const { hasDecimal, num: fullNum, current: afterDecimal } = parseDecimalPart(current);
  const value = convertToNumber(intPart + fullNum, hasDecimal);
  if (value === null) {
    return null;
  }

  return {
    token: createNumberToken({ value, lineno, colno, hasDecimal }),
    state: afterDecimal,
  };
};
