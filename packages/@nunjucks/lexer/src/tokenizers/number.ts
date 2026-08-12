import type { Tokenizer, LexerState } from '../types.ts';
import { isDigit } from '../constants.ts';
import { advance } from '../state.ts';
import { createNumberToken } from '../tokens.ts';

const parseDigits = (current: LexerState): { num: string; current: LexerState } => {
  const scan = (pos: LexerState, num: string): { num: string; current: LexerState } => {
    if (pos.index >= pos.str.length || !isDigit(pos.str[pos.index] ?? '')) {
      return { num, current: pos };
    }
    return scan(advance(pos), num + (pos.str[pos.index] ?? ''));
  };
  return scan(current, '');
};

const parseDecimalPart = (current: LexerState): { hasDecimal: boolean; num: string; current: LexerState } => {
  if (current.index < current.str.length && (current.str[current.index] ?? '') === '.') {
    const nextChar = current.str[current.index + 1] ?? '';
    if (nextChar === '.') { return { hasDecimal: false, num: '', current }; }
    const afterDot = advance(current);
    const { num: decimalDigits, current: newCurrent } = parseDigits(afterDot);
    const num = `.${decimalDigits}`;
    return { hasDecimal: true, num, current: newCurrent };
  }
  return { hasDecimal: false, num: '', current };
};

const convertToNumber = (num: string, hasDecimal: boolean): number | null => {
  if (!num || num === '.') { return null; }
  const value = hasDecimal ? Number.parseFloat(num) : Number.parseInt(num, 10);
  return Number.isNaN(value) ? null : value;
};

export const tokenizeNumber: Tokenizer = (state) => {
  const { lineno, colno } = state;
  const { num: intPart, current } = parseDigits(state);
  const { hasDecimal, num: fullNum, current: afterDecimal } = parseDecimalPart(current);
  const value = convertToNumber(intPart + fullNum, hasDecimal);
  if (value === null) { return null; }

  return {
    token: createNumberToken({ value, lineno, colno, hasDecimal }),
    state: afterDecimal,
  };
};
