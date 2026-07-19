import {
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
  type Delimiters,
  type ComplexOperator,
} from './delimiters';

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
};

export type { Delimiters, ComplexOperator };

const isComplexOperator = (str: string): boolean =>
  (COMPLEX_OPERATORS as readonly string[]).includes(str);

const isDigit = (char: string): boolean => char >= '0' && char <= '9';

const isNumericString = (str: string): boolean =>
  str.length > 0 && str.split('').every(isDigit);

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
