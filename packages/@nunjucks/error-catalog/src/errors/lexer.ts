import type { ErrorDefinition } from './types.ts';

/**
 * Catalogues lexer-phase error definitions (code → `ErrorDefinition`).
 * Message params `{char}` and `{kind}` double as pattern captures; each entry
 * carries its own `subjectFrom` and fix hints for classification.
 */
export const LEXER_ERRORS = {
  UNEXPECTED_CHAR: {
    name: 'UNEXPECTED_CHAR',
    message: "Unexpected character '{char}'",
    pattern: /^Unexpected character '(.+)' at line (\d+):(\d+)$/iu,
    category: 'lexer_error',
    titleTemplate: 'Unexpected character in the template',
    causes: [
      'The template contains a **character that is not valid** in the current context',
      'A tag or expression is **unclosed or malformed**',
      'Check for **typos** in template syntax',
    ],
    fixCode: 'Review the template syntax at the indicated line',
    fixComment: 'Remove or replace the unexpected character',
    subjectFrom: (match) => match?.[1] ?? null,
  },
  UNEXPECTED_BACKTICK: {
    name: 'UNEXPECTED_BACKTICK',
    message: 'Unexpected backtick in template expression',
    pattern: /^Unexpected backtick in template expression$/iu,
    category: 'lexer_error',
    titleTemplate: 'Unexpected backtick in template expression',
    causes: [
      'A **backtick** (\u0060) was used inside a template expression',
      'Template literals within template literals are **not supported**',
    ],
    fixCode: '{{ "use backtick elsewhere" }}',
    fixComment: 'Remove the backtick from inside the template expression',
    subjectFrom: null,
  },
  UNTERMINATED_LITERAL: {
    name: 'UNTERMINATED_LITERAL',
    message: 'Unterminated {kind} literal',
    pattern: /^Unterminated (.+) literal$/iu,
    category: 'lexer_error',
    titleTemplate: 'Unterminated {kind} literal',
    causes: [
      'A **string, comment, or template literal** is missing its closing delimiter',
      'The opening delimiter has **no matching close** before the end of the template',
    ],
    fixCode: "{{ 'closed string' }}",
    fixComment: 'Add the missing closing delimiter',
    subjectFrom: (match) => match?.[1] ?? null,
  },
} as const satisfies Record<string, ErrorDefinition>;
