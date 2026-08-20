import { createLog } from '@nunjucks/error-formatter';
import { MATCH_ANY_RE } from '@nunjucks/lib';

/** Characters treated as whitespace while scanning template source. */
export const WHITESPACE_CHARS = ' \n\t\r\u00A0';
/** Single characters that terminate symbols and open operators or punctuation. */
export const DELIM_CHARS = '()[]{}%*-+~/#,:|&.<>=!?`';

// WHY: module-level membership Sets for the per-character lexer hot loop — a single
// allocation at module load gives O(1) has() checks, replacing per-scan string.includes
// (O(N) over the char class) and per-call Set construction in the extract helpers.
export const WHITESPACE_CHAR_SET: ReadonlySet<string> = new Set([...WHITESPACE_CHARS]);
export const DELIM_CHAR_SET: ReadonlySet<string> = new Set([...DELIM_CHARS]);
/** Characters that terminate a symbol scan: whitespace or a delimiter/operator char. */
export const SYMBOL_TERMINATOR_SET: ReadonlySet<string> = new Set([
  ...WHITESPACE_CHARS,
  ...DELIM_CHARS,
]);

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

const COMPLEX_OPERATOR_SET = new Set<string>(COMPLEX_OPERATORS);

/** Tests whether `str` is one of the frozen multi-character operators. */
export const isComplexOperator = (str: string): boolean => COMPLEX_OPERATOR_SET.has(str);

/** Tests whether `str` is the literal text `true` or `false`. */
export const isBooleanString = (str: string): boolean => str === 'true' || str === 'false';

/** Tests whether `str` is the null keyword `none` or `null`. */
export const isNullString = (str: string): boolean => str === 'none' || str === 'null';

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

// WHY: membership twin of the array above — the parser probes it per operator
// token, so O(1) has() replaces the O(N) includes() scan (same pattern as
// COMPLEX_OPERATOR_SET and the delimiter Sets).
export const COMPOUND_ASSIGNMENT_OP_SET: ReadonlySet<string> = new Set(COMPOUND_ASSIGNMENT_OPS);

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

const throwEmptyDelimiterError = (name: string): never => {
  throw createLog('error', {
    def: {
      name: 'INVALID_DELIMITER_CONFIG',
      message: () => `Delimiter tag "${name}" must be a non-empty string`,
      pattern: MATCH_ANY_RE,
    },
    params: { name },
    subject: null,
    context: { lineno: 0, colno: 0, phase: 'parse', lineBase: 'zero' },
  });
};

const resolveTag = (name: string, value: string | undefined, fallback: string): string => {
  // WHY: an empty-string override slips past the `??` fallback and makes `matches('')`
  // vacuously true at every cursor position, silently consuming the whole source as one
  // tag — reject it at construction instead.
  if (value === '') {
    throwEmptyDelimiterError(name);
  }
  return value ?? fallback;
};

/**
 * Resolves delimiter tags by filling omitted pairs with the `DEFAULT_*` constants;
 * strip variants are always the fixed `{%-`-style forms regardless of overrides, and
 * an explicitly empty tag is rejected as invalid configuration.
 */
export const createDelimiters = (tags: DelimiterTags = {}): Delimiters => ({
  blockStart: resolveTag('blockStart', tags.blockStart, DEFAULT_BLOCK_START),
  blockEnd: resolveTag('blockEnd', tags.blockEnd, DEFAULT_BLOCK_END),
  variableStart: resolveTag('variableStart', tags.variableStart, DEFAULT_VARIABLE_START),
  variableEnd: resolveTag('variableEnd', tags.variableEnd, DEFAULT_VARIABLE_END),
  commentStart: resolveTag('commentStart', tags.commentStart, DEFAULT_COMMENT_START),
  commentEnd: resolveTag('commentEnd', tags.commentEnd, DEFAULT_COMMENT_END),
  stripBlockStart: STRIP_BLOCK_START,
  stripBlockEnd: STRIP_BLOCK_END,
  stripVariableStart: STRIP_VARIABLE_START,
  stripVariableEnd: STRIP_VARIABLE_END,
});
