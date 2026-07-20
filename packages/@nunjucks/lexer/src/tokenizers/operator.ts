import type { Tokenizer } from '../types';
import { DELIM_CHARS, validators } from '../constants';
import { getChar, getPeek, advance } from '../state';
import { createToken } from '../tokens';
import type { TokenType } from '../token-types';

const { isComplexOperator } = validators;

export const tokenizeOperator: Tokenizer = (state) => {
  const char = getChar(state);
  if (!DELIM_CHARS.includes(char)) return null;

  let op = char;
  let current = advance(state);

  const twoChar = char + getPeek(current);
  if (isComplexOperator(twoChar)) {
    op = twoChar;
    current = advance(current);

    const threeChar = twoChar + getPeek(current);
    if (isComplexOperator(threeChar)) {
      op = threeChar;
      current = advance(current);
    }
  }

  let type: TokenType = 'operator' as TokenType;
  if (op === '|>') type = 'pipe-forward' as TokenType;
  else if (op === '...') type = 'spread' as TokenType;

  return {
    token: createToken(type, op, state.lineno, state.colno),
    state: current,
  };
};
