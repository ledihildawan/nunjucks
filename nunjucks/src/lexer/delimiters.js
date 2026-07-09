export const WHITESPACE_CHARS = ' \n\t\r\u00A0';
export const DELIM_CHARS = '()[]{}%*-+~/#,:|&.<>=!?';
export const INT_CHARS = '0123456789';

export const DEFAULT_BLOCK_START = '{%';
export const DEFAULT_BLOCK_END = '%}';
export const DEFAULT_VARIABLE_START = '{{';
export const DEFAULT_VARIABLE_END = '}}';
export const DEFAULT_COMMENT_START = '{#';
export const DEFAULT_COMMENT_END = '#}';

export const COMPLEX_OPERATORS = [
  '==', '===', '!=', '!==', '<=', '>=', '//', '**', '?.', '??', '.?', '||', '&&',
  '||=', '&&=', '??=', '|>'
];

export const REGEX_FLAGS = ['g', 'i', 'm', 'y'];

export const createDelimiters = (tags = {}) => ({
  BLOCK_START: tags.blockStart || DEFAULT_BLOCK_START,
  BLOCK_END: tags.blockEnd || DEFAULT_BLOCK_END,
  VARIABLE_START: tags.variableStart || DEFAULT_VARIABLE_START,
  VARIABLE_END: tags.variableEnd || DEFAULT_VARIABLE_END,
  COMMENT_START: tags.commentStart || DEFAULT_COMMENT_START,
  COMMENT_END: tags.commentEnd || DEFAULT_COMMENT_END,
});
