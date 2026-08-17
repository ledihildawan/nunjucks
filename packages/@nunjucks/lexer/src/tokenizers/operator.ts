import { DELIM_CHARS, isComplexOperator } from '../constants.ts';
import { advance, getChar, getPeek } from '../state.ts';
import {
  TOKEN_COLON,
  TOKEN_COMMA,
  TOKEN_LEFT_BRACKET,
  TOKEN_LEFT_CURLY,
  TOKEN_LEFT_PAREN,
  TOKEN_OPERATOR,
  TOKEN_PIPEFORWARD,
  TOKEN_RIGHT_BRACKET,
  TOKEN_RIGHT_CURLY,
  TOKEN_RIGHT_PAREN,
  TOKEN_SPREAD,
  type TokenType,
} from '../token-types.ts';
import { createToken } from '../tokens.ts';
import type { Tokenizer } from '../types.ts';

const MAX_OPERATOR_CHARS = 3;

// WHY: derives from the canonical token-type constants so the operator→type mapping
// cannot drift from token-types.ts (SSOT).
const OPERATOR_TOKEN_TYPES: Record<string, TokenType> = {
  '(': TOKEN_LEFT_PAREN,
  ')': TOKEN_RIGHT_PAREN,
  '[': TOKEN_LEFT_BRACKET,
  ']': TOKEN_RIGHT_BRACKET,
  '{': TOKEN_LEFT_CURLY,
  '}': TOKEN_RIGHT_CURLY,
  ',': TOKEN_COMMA,
  ':': TOKEN_COLON,
  '|>': TOKEN_PIPEFORWARD,
  '...': TOKEN_SPREAD,
};

/**
 * Tokenizes operators and punctuation by longest match up to three characters, mapping
 * brackets, `,`, `:`, `|>`, and `...` to their dedicated token types.
 */
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

  const type: TokenType = OPERATOR_TOKEN_TYPES[op] ?? TOKEN_OPERATOR;

  return {
    token: createToken({ type, value: op, lineno: state.lineno, colno: state.colno }),
    state: current,
  };
};
