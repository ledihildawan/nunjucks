// Needed locally to build the operator lookup set below.
import { COMPLEX_OPERATORS } from './delimiters.ts';

export {
  WHITESPACE_CHARS,
  DELIM_CHARS,
  INT_CHARS,
  DEFAULT_BLOCK_START,
  DEFAULT_BLOCK_END,
  DEFAULT_VARIABLE_START,
  DEFAULT_VARIABLE_END,
  DEFAULT_COMMENT_START,
  DEFAULT_COMMENT_END,
  COMPLEX_OPERATORS,
  REGEX_FLAGS,
  createDelimiters,
} from './delimiters.ts';

export type { Delimiters, ComplexOperator } from './delimiters.ts';

const COMPLEX_OPERATOR_SET = new Set<string>(COMPLEX_OPERATORS);

const isComplexOperator = (str: string): boolean =>
  COMPLEX_OPERATOR_SET.has(str);

const isDigit = (char: string): boolean => char >= '0' && char <= '9';

const isNumericString = (str: string): boolean => {
  if (str.length === 0) { return false; }
  for (const char of str) {
    if (!isDigit(char)) { return false; }
  }
  return true;
};

const isBooleanString = (str: string): boolean =>
  str === 'true' || str === 'false';

const isNullString = (str: string): boolean =>
  str === 'none' || str === 'null';

export const validators = {
  isComplexOperator,
  isDigit,
  isNumericString,
  isBooleanString,
  isNullString,
};
