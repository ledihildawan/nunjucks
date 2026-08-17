/** Characters treated as whitespace while scanning template source. */
export const WHITESPACE_CHARS = ' \n\t\r\u00A0';
/** Single characters that terminate symbols and open operators or punctuation. */
export const DELIM_CHARS = '()[]{}%*-+~/#,:|&.<>=!?`';
/** The decimal digits `0` through `9`. */
export const INT_CHARS = '0123456789';

/**
 * Default tag delimiters for blocks, variables, and comments; each plain pair can be
 * overridden via `DelimiterTags`, unlike the fixed strip variants below.
 */
export const DEFAULT_BLOCK_START = '{%';
export const DEFAULT_BLOCK_END = '%}';
export const DEFAULT_VARIABLE_START = '{{';
export const DEFAULT_VARIABLE_END = '}}';
export const DEFAULT_COMMENT_START = '{#';
export const DEFAULT_COMMENT_END = '#}';

/** Whitespace-stripping tag variants, derived from the plain forms; never remapped. */
export const STRIP_BLOCK_START = '{%-';
export const STRIP_BLOCK_END = '-%}';
export const STRIP_VARIABLE_START = '{{-';
export const STRIP_VARIABLE_END = '-}}';

/**
 * Multi-character operators recognized by longest-match, from comparisons and logical
 * pairs to compound assignments, pipeline `|>`, and range `..`/`...`; frozen so the
 * `ComplexOperator` union stays literal-exact.
 */
export const COMPLEX_OPERATORS = [
  '==',
  '===',
  '!=',
  '!==',
  '<=',
  '>=',
  '//',
  '**',
  '?.',
  '??',
  '.?',
  '||',
  '&&',
  '||=',
  '&&=',
  '??=',
  '|>',
  '..',
  '...',
  '**=',
  '//=',
  ':=',
  '<<',
  '>>',
  '++',
  '--',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '|>=',
] as const;

/** Union of every multi-character operator literal in `COMPLEX_OPERATORS`. */
export type ComplexOperator = (typeof COMPLEX_OPERATORS)[number];

/** The `=`-suffixed subset of complex operators that perform assignment. */
export const COMPOUND_ASSIGNMENT_OPS: readonly string[] = [
  '||=',
  '&&=',
  '??=',
  '**=',
  '//=',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
];

/** Regex flag characters accepted after a `/.../` literal body. */
export const REGEX_FLAGS = ['g', 'i', 'm', 'y'] as const;

/**
 * Fully resolved tag delimiters: plain forms plus the fixed whitespace-strip variants
 * (`{%-`, `-%}`, `{{-`, `-}}`) used to detect strip-flagged tags.
 */
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

/** Partial tag overrides; omitted pairs fall back to the `DEFAULT_*` delimiters. */
export interface DelimiterTags {
  blockStart?: string;
  blockEnd?: string;
  variableStart?: string;
  variableEnd?: string;
  commentStart?: string;
  commentEnd?: string;
}

/**
 * Resolves delimiter tags by filling omitted pairs with the `DEFAULT_*` constants;
 * strip variants are always the fixed `{%-`-style forms regardless of overrides.
 */
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
