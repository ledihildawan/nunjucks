import type { Tokenizer } from '../types.ts';
import { validators } from '../constants.ts';
import { advance } from '../state.ts';
import { createNumberToken } from '../tokens.ts';

const { isDigit } = validators;

export const tokenizeNumber: Tokenizer = (state) => {
  let num = '';
  let hasDecimal = false;
  const { lineno, colno } = state;
  let current = state;

  while (
    current.index < current.str.length &&
    isDigit(current.str[current.index] ?? '')
  ) {
    num += current.str[current.index] ?? '';
    current = advance(current);
  }

  if (current.index < current.str.length && (current.str[current.index] ?? '') === '.') {
    hasDecimal = true;
    num += '.';
    current = advance(current);
    while (
      current.index < current.str.length &&
      isDigit(current.str[current.index] ?? '')
    ) {
      num += current.str[current.index] ?? '';
      current = advance(current);
    }
  }

  if (!num || num === '.') { return null; }

  let value: number;
  if (hasDecimal) {
    value = Number.parseFloat(num);
  } else {
    value = Number.parseInt(num, 10);
  }
  if (Number.isNaN(value)) { return null; }

  return {
    token: createNumberToken(value, lineno, colno, hasDecimal),
    state: current,
  };
};
