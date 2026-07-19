import type { Tokenizer } from '../types';
import { validators } from '../constants';
import { getPeek } from '../state';
import { advance } from '../state';
import { createNumberToken } from '../tokens';
import type { TokenType } from '../token-types';

const { isDigit } = validators;

export const tokenizeNumber: Tokenizer = (state) => {
  let num = '';
  let hasDecimal = false;
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

  if (!num || (num === '.' && !hasDecimal)) return null;

  const value = hasDecimal ? parseFloat(num) : parseInt(num, 10);
  return {
    token: createNumberToken(value, current.lineno, current.colno, hasDecimal),
    state: current,
  };
};
