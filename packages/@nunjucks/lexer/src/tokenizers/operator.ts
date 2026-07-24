import type { Tokenizer } from '../types.ts';
import { DELIM_CHARS, validators } from '../constants.ts';
import { getChar, getPeek, advance } from '../state.ts';
import { createToken } from '../tokens.ts';
import type { TokenType } from '../token-types.ts';

const { isComplexOperator } = validators;

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

  let op = char;
  let numChars = 1;

  const twoChar = char + getPeek(state);
  if (isComplexOperator(twoChar)) {
    op = twoChar;
    numChars = 2;

    const threeCharState = advance(state, 2);
    const threeChar = twoChar + getChar(threeCharState);
    if (isComplexOperator(threeChar)) {
      op = threeChar;
      numChars = 3;
    }
  }

  const current = advance(state, numChars);

  let type: TokenType = matchTokenType(op);
  if (op === '...') { type = 'spread' as TokenType; }

  return {
    token: createToken(type, op, state.lineno, state.colno),
    state: current,
  };
};
