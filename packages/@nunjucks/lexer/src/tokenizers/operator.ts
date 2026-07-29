import type { Tokenizer } from '../types.ts';
import { DELIM_CHARS, validators } from '../constants.ts';
import { getChar, getPeek, advance } from '../state.ts';
import { createToken } from '../tokens.ts';
import type { TokenType } from '../token-types.ts';

const { isComplexOperator } = validators;

/** Longest operator the lexer recognises, e.g. `**=` or `>>>`. */
const MAX_OPERATOR_CHARS = 3;

const TOKEN_TYPES: Record<string, TokenType> = {
  '(' : 'left-paren' as TokenType,
  ')' : 'right-paren' as TokenType,
  '[' : 'left-bracket' as TokenType,
  ']' : 'right-bracket' as TokenType,
  '{' : 'left-curly' as TokenType,
  '}' : 'right-curly' as TokenType,
  ',' : 'comma' as TokenType,
  ':' : 'colon' as TokenType,
  '|>' : 'pipe-forward' as TokenType,
};

const matchTokenType = (char: string): TokenType => TOKEN_TYPES[char] ?? 'operator' as TokenType;

export const tokenizeOperator: Tokenizer = (state) => {
  const char = getChar(state);
  if (!DELIM_CHARS.includes(char)) { return null; }

  const twoChar = char + getPeek(state);
  const threeChar = twoChar + getChar(advance(state, 2));

  const op = isComplexOperator(threeChar)
    ? threeChar
    : isComplexOperator(twoChar)
      ? twoChar
      : char;

  const numChars = isComplexOperator(threeChar)
    ? MAX_OPERATOR_CHARS
    : isComplexOperator(twoChar)
      ? 2
      : 1;

  const current = advance(state, numChars);

  const type: TokenType = op === '...' ? ('spread' as TokenType) : matchTokenType(op);

  return {
    token: createToken(type, op, state.lineno, state.colno),
    state: current,
  };
};
