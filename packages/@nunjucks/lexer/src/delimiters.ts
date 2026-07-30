export const WHITESPACE_CHARS = ' \n\t\r\u00A0';
export const DELIM_CHARS = '()[]{}%*-+~/#,:|&.<>=!?`';
export const INT_CHARS = '0123456789';

export const DEFAULT_BLOCK_START = '{%';
export const DEFAULT_BLOCK_END = '%}';
export const DEFAULT_VARIABLE_START = '{{';
export const DEFAULT_VARIABLE_END = '}}';
export const DEFAULT_COMMENT_START = '{#';
export const DEFAULT_COMMENT_END = '#}';

export const STRIP_BLOCK_START = '{%-';
export const STRIP_BLOCK_END = '-%}';
export const STRIP_VARIABLE_START = '{{-';
export const STRIP_VARIABLE_END = '-}}';

export const COMPLEX_OPERATORS = [
  '==', '===', '!=', '!==', '<=', '>=', '//', '**', '?.', '??', '.?', '||', '&&',
  '||=', '&&=', '??=', '|>', '..', '...', '**=', '//=', ':=', '<<', '>>', '++', '--',
  '+=', '-=', '*=', '/=', '%=', '|>='
] as const;

export type ComplexOperator = typeof COMPLEX_OPERATORS[number];

// Compound-assignment operators (arithmetic + logical). Single source of truth
// shared by the parser (statement + expression contexts) and aligned with the
// compiler. `|>=` (pipe-forward assign) is intentionally excluded: it is handled
// as a distinct case by the parser/compiler.
export const COMPOUND_ASSIGNMENT_OPS: readonly string[] = [
  '||=', '&&=', '??=', '**=', '//=', '+=', '-=', '*=', '/=', '%=',
];

export const REGEX_FLAGS = ['g', 'i', 'm', 'y'] as const;

export interface Delimiters {
  BLOCK_START: string;
  BLOCK_END: string;
  VARIABLE_START: string;
  VARIABLE_END: string;
  COMMENT_START: string;
  COMMENT_END: string;
  STRIP_BLOCK_START: string;
  STRIP_BLOCK_END: string;
  STRIP_VARIABLE_START: string;
  STRIP_VARIABLE_END: string;
}

export interface DelimiterTags {
  blockStart?: string;
  blockEnd?: string;
  variableStart?: string;
  variableEnd?: string;
  commentStart?: string;
  commentEnd?: string;
}

export const createDelimiters = (tags: DelimiterTags = {}): Delimiters => ({
  BLOCK_START: tags.blockStart || DEFAULT_BLOCK_START,
  BLOCK_END: tags.blockEnd || DEFAULT_BLOCK_END,
  VARIABLE_START: tags.variableStart || DEFAULT_VARIABLE_START,
  VARIABLE_END: tags.variableEnd || DEFAULT_VARIABLE_END,
  COMMENT_START: tags.commentStart || DEFAULT_COMMENT_START,
  COMMENT_END: tags.commentEnd || DEFAULT_COMMENT_END,
  STRIP_BLOCK_START,
  STRIP_BLOCK_END,
  STRIP_VARIABLE_START,
  STRIP_VARIABLE_END,
});
