import { isDigit } from '@nunjucks/lib';
import { COMPLEX_OPERATORS } from './delimiters.ts';

const COMPLEX_OPERATOR_SET = new Set<string>(COMPLEX_OPERATORS);

const isComplexOperator = (str: string): boolean => COMPLEX_OPERATOR_SET.has(str);

const isBooleanString = (str: string): boolean => str === 'true' || str === 'false';

const isNullString = (str: string): boolean => str === 'none' || str === 'null';

export type { ComplexOperator, Delimiters } from './delimiters.ts';

export {
  COMPLEX_OPERATORS,
  createDelimiters,
  DEFAULT_BLOCK_END,
  DEFAULT_BLOCK_START,
  DEFAULT_COMMENT_END,
  DEFAULT_COMMENT_START,
  DEFAULT_VARIABLE_END,
  DEFAULT_VARIABLE_START,
  DELIM_CHARS,
  INT_CHARS,
  REGEX_FLAGS,
  WHITESPACE_CHARS,
} from './delimiters.ts';
export { isBooleanString, isComplexOperator, isDigit, isNullString };
