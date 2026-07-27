import type { Tokenizer } from '../types.ts';
import { validators } from '../constants.ts';
import { advance } from '../state.ts';
import { createNumberToken } from '../tokens.ts';

const { isDigit } = validators;

const parseDigits = (current: ReturnType<typeof advance>): { num: string; current: ReturnType<typeof advance> } => {
  let num = '';
  while (
    current.index < current.str.length &&
    isDigit(current.str[current.index] ?? '')
  ) {
    num += current.str[current.index] ?? '';
    current = advance(current);
  }
  return { num, current };
};

const parseDecimalPart = (current: ReturnType<typeof advance>): { hasDecimal: boolean; num: string; current: ReturnType<typeof advance> } => {
  if (current.index < current.str.length && (current.str[current.index] ?? '') === '.') {
    const afterDot = advance(current);
    const { num: decimalDigits, current: newCurrent } = parseDigits(afterDot);
    const num = '.' + decimalDigits;
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
    token: createNumberToken(value, lineno, colno, hasDecimal),
    state: afterDecimal,
  };
};
