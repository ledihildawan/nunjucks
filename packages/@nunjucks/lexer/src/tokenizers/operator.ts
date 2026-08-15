import { DELIM_CHARS, isComplexOperator } from '../constants.ts';
import { advance, getChar, getPeek } from '../state.ts';
import type { TokenType } from '../token-types.ts';
import { createToken } from '../tokens.ts';
import type { Tokenizer } from '../types.ts';

const MAX_OPERATOR_CHARS = 3;

const TOKEN_TYPES: Record<string, TokenType> = {
  '(': 'left-paren',
  ')': 'right-paren',
  '[': 'left-bracket',
  ']': 'right-bracket',
  '{': 'left-curly',
  '}': 'right-curly',
  ',': 'comma',
  ':': 'colon',
  '|>': 'pipe-forward',
};

const matchTokenType = (char: string): TokenType => TOKEN_TYPES[char] ?? 'operator';

export const tokenizeOperator: Tokenizer = (state) => {
  const char = getChar(state);
  if (!DELIM_CHARS.includes(char)) {
    return null;
  }

  const twoChar = char + getPeek(state);
  const threeChar = twoChar + getChar(advance(state, 2));

  const opLen = isComplexOperator(threeChar)
    ? MAX_OPERATOR_CHARS
    : isComplexOperator(twoChar)
      ? 2
      : 1;

  const op = opLen === MAX_OPERATOR_CHARS ? threeChar : opLen === 2 ? twoChar : char;
  const current = advance(state, opLen);

  const type: TokenType = op === '...' ? 'spread' : matchTokenType(op);

  return {
    token: createToken({ type, value: op, lineno: state.lineno, colno: state.colno }),
    state: current,
  };
};
