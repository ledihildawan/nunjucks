import { COMPLEX_OPERATORS } from './delimiters.ts';

const COMPLEX_OPERATOR_SET = new Set<string>(COMPLEX_OPERATORS);

const isComplexOperator = (str: string): boolean =>
  COMPLEX_OPERATOR_SET.has(str);

const isDigit = (char: string): boolean => char >= '0' && char <= '9';

const isBooleanString = (str: string): boolean =>
  str === 'true' || str === 'false';

const isNullString = (str: string): boolean =>
  str === 'none' || str === 'null';

export { isComplexOperator, isDigit, isBooleanString, isNullString };

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
