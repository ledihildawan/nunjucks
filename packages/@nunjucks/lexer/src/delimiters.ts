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

export const COMPOUND_ASSIGNMENT_OPS: readonly string[] = [
  '||=', '&&=', '??=', '**=', '//=', '+=', '-=', '*=', '/=', '%=',
];

export const REGEX_FLAGS = ['g', 'i', 'm', 'y'] as const;

export interface Delimiters {
  blockStart: string;
  blockEnd: string;
  variableStart: string;
  variableEnd: string;
  commentStart: string;
  commentEnd: string;
  stripBlockStart: string;
  stripBlockEnd: string;
  stripVariableStart: string;
  stripVariableEnd: string;
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
  blockStart: tags.blockStart ?? DEFAULT_BLOCK_START,
  blockEnd: tags.blockEnd ?? DEFAULT_BLOCK_END,
  variableStart: tags.variableStart ?? DEFAULT_VARIABLE_START,
  variableEnd: tags.variableEnd ?? DEFAULT_VARIABLE_END,
  commentStart: tags.commentStart ?? DEFAULT_COMMENT_START,
  commentEnd: tags.commentEnd ?? DEFAULT_COMMENT_END,
  stripBlockStart: STRIP_BLOCK_START,
  stripBlockEnd: STRIP_BLOCK_END,
  stripVariableStart: STRIP_VARIABLE_START,
  stripVariableEnd: STRIP_VARIABLE_END,
});
