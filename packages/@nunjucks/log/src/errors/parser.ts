import type { ErrorDefinition, SubjectExtractor } from './types.ts';

const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

const DOCS_BASE = 'https://mozilla.github.io/nunjucks/templating.html';

export const PARSER_ERRORS = {
  SYNTAX_ERROR: {
    name: 'SYNTAX_ERROR',
    message: 'Syntax error',
    pattern: /^Unexpected token|unexpected end of file|unexpected end of template|unexpected token:|parse error|Parse error|Unexpected end of input|^expected arguments$|^expected (?:comma|right bracket|block end|endtry|elif|else|endif)|^tag name expected|^invalid boolean|^expected expression, got end of file|^expected [a-zA-Z]+(?:, got [a-zA-Z.]+)?$/i,
    category: 'syntax_error',
    titleTemplate: "Template syntax error",
    causes: [
      'Missing closing tag (e.g. `{% endif %}`, `{% endfor %}`, `{% endblock %}`)',
      '**Mismatched quotes** or brackets in expressions',
      '**Unclosed** array or object brackets like `[` without `]`',
      'A character is missing or out of place at the caret position'
    ],
    fixCode: '{% if condition %}\n  {{ value }}\n{% endif %}',
    fixComment: 'Verify all opening tags have matching closing tags and all brackets/quotes are paired',
    suggestion: 'Use an editor with Nunjucks syntax highlighting to visually spot mismatched brackets',
    documentationUrl: `${DOCS_BASE}#tags`,
    subjectFrom: null
  },
  PARSER_UNEXPECTED_TOKEN: {
    name: 'PARSER_UNEXPECTED_TOKEN',
    message: "Unexpected token '{token}' while parsing",
    pattern: /^Unexpected token '([^']+)' while parsing$/i,
    category: 'syntax_error',
    titleTemplate: "Unexpected token '{subject}'",
    causes: [
      'A character that the parser did not expect at this position',
      'An operator used in an invalid context',
      'A keyword used where a value was expected (or vice versa)'
    ],
    fixCode: '{{ a + b }}',
    fixComment: 'Check the operator and operand types around the error position',
    suggestion: 'Verify the syntax matches the docs at the caret position',
    documentationUrl: `${DOCS_BASE}#expressions`,
    subjectFrom: firstCapture
  },
  PARSER_EXPECTED: {
    name: 'PARSER_EXPECTED',
    message: 'expected {expected}',
    pattern: /^expected (.+)$/i,
    category: 'syntax_error',
    titleTemplate: "Expected token '{subject}'",
    causes: [
      'The parser expected a specific token at this position',
      'A required keyword or symbol is missing',
      'A previous tag is unclosed or missing a parameter'
    ],
    fixCode: '{% if condition %}{% endif %}',
    fixComment: 'Add the missing token indicated by the error message',
    suggestion: 'Look at the line above and below for unclosed tags or missing syntax',
    subjectFrom: firstCapture
  },
  PARSER_EXPECTED_IN: {
    name: 'PARSER_EXPECTED_IN',
    message: 'expected "in" keyword for loop',
    pattern: /parseFor: expected "in" keyword for loop|^expected "in" keyword for loop$/i,
    category: 'syntax_error',
    titleTemplate: 'For loop missing "in" keyword',
    causes: [
      'The `for` loop syntax is incomplete',
      'Missing the `in` keyword between the variable and the iterable',
      'A typo (e.g. `of` instead of `in`)'
    ],
    fixCode: '{% for item in items %}\n  {{ item }}\n{% endfor %}',
    fixComment: 'The correct syntax is `{% for VAR in COLLECTION %}`',
    suggestion: 'Nunjucks uses `in` not `of` like Python',
    subjectFrom: null
  },
  PARSER_VARIABLE_NAME: {
    name: 'PARSER_VARIABLE_NAME',
    message: 'variable name expected',
    pattern: /(?:parseBlock|parseFor): variable name expected|^variable name expected$/i,
    category: 'syntax_error',
    titleTemplate: 'Variable name expected',
    causes: [
      'A variable name is missing where one is required',
      'The identifier starts with a digit or contains invalid characters',
      'Missing identifier after a `set` or `for` keyword'
    ],
    fixCode: '{% set validName = value %}',
    fixComment: 'Use a valid identifier: letters, digits, underscores (not starting with digit)',
    suggestion: 'Identifiers can only contain `[a-zA-Z0-9_]` and cannot start with a number',
    subjectFrom: null
  },
  PARSER_TAG_NAME: {
    name: 'PARSER_TAG_NAME',
    message: 'tag name expected',
    pattern: /^tag name expected$|parse(?:Block|From|TemplateRef|FilterStatement|If|Import|Include): expected [a-zA-Z]+$/i,
    category: 'syntax_error',
    titleTemplate: 'Tag name expected',
    causes: [
      'A tag (e.g. `if`, `for`, `set`) is missing its name',
      'A keyword was used where a tag was expected',
      'The tag is malformed'
    ],
    fixCode: '{% if condition %}...{% endif %}',
    fixComment: 'Make sure the tag has a valid name like `if`, `for`, `block`, `set`, etc.',
    suggestion: 'See the docs for the full list of supported tags',
    documentationUrl: `${DOCS_BASE}#tags`,
    subjectFrom: null
  },
  PARSER_EXPRESSION: {
    name: 'PARSER_EXPRESSION',
    message: 'expected expression',
    pattern: /^expected expression, got end of file$|parseAggregate: expected (?:comma|colon)/i,
    category: 'syntax_error',
    titleTemplate: 'Expression expected',
    causes: [
      'An expression is required but was not provided',
      'Empty `{{ }}` or `{% %}` blocks',
      'Missing expression after `=`, `:`, `,`, or other operator'
    ],
    fixCode: '{{ variableName }}\n{% if variableName %}...{% endif %}',
    fixComment: 'Add a valid expression in place of the missing one',
    suggestion: 'A simple expression can be a variable name, number, or string',
    subjectFrom: null
  },
  PARSER_ERROR: {
    name: 'PARSER_ERROR',
    message: 'Unexpected value while parsing',
    pattern: /^Unexpected value while parsing$/i,
    category: 'syntax_error',
    titleTemplate: 'Unexpected value while parsing',
    causes: [
      'An unexpected value was encountered during parsing',
      'Template contains a token sequence that the parser cannot interpret',
      'A custom extension returned an invalid AST node'
    ],
    fixCode: '/* Check syntax at the reported location */',
    fixComment: 'Review the template around the reported line and column',
    suggestion: 'Try simplifying the problematic expression to isolate the issue',
    subjectFrom: null
  },
  PARSER_PUSH_TOKEN: {
    name: 'PARSER_PUSH_TOKEN',
    message: 'can only push one token',
    pattern: /can only push one token/i,
    category: 'syntax_error',
    titleTemplate: 'Parser internal error - too many pushed tokens',
    causes: [
      'The parser tried to push back multiple tokens at once',
      'This is typically a nunjucks internal issue, not a template syntax problem'
    ],
    fixCode: '/* This is an internal parser issue */',
    fixComment: 'This is a parser bug, please report it with the template that triggered it',
    suggestion: 'Try to simplify the expression that triggers this error',
    documentationUrl: 'https://github.com/mozilla/nunjucks/issues',
    subjectFrom: null
  },
  EXPECTED_VARIABLE_END: {
    name: 'EXPECTED_VARIABLE_END',
    message: 'expected variable end',
    pattern: /^expected variable end$/i,
    category: 'syntax_error',
    titleTemplate: 'Missing closing }}',
    causes: [
      'Missing closing `}}` in a variable expression like `{{ value`',
      'The variable expression is not properly terminated',
      'A multi-line expression is missing its closing tag'
    ],
    fixCode: '{{ value }}',
    fixComment: 'Add the missing closing `}}` to terminate the variable expression',
    suggestion: 'Make sure every `{{` has a matching `}}`',
    subjectFrom: null
  },
  UNKNOWN_BLOCK_TAG: {
    name: 'UNKNOWN_BLOCK_TAG',
    message: "unknown block tag: {tag}",
    pattern: /^unknown block tag: (.+)$/i,
    category: 'unknown_block_tag',
    titleTemplate: "Unknown tag: {subject}",
    causes: [
      'A typo in the block tag name (e.g. `{% iff %}` instead of `{% if %}`)',
      'A custom tag has not been registered',
      'An unmatched closing tag (e.g. `{% endif %}` without `{% if %}`)'
    ],
    fixCode: '{% if condition %}...{% endif %}',
    fixComment: 'Use only registered tags, or register custom tags via env.addExtension()',
    suggestion: 'See the docs for the list of built-in tags and how to register custom ones',
    documentationUrl: `${DOCS_BASE}#tags`,
    subjectFrom: firstCapture
  },
  INVALID_BOOLEAN: {
    name: 'INVALID_BOOLEAN',
    message: 'invalid boolean',
    pattern: /^invalid boolean(?:: .+)?$/i,
    category: 'syntax_error',
    titleTemplate: 'Invalid boolean value',
    causes: [
      'A non-boolean value was used where a boolean was expected',
      'A custom extension returns a non-boolean from a test',
      'The literal `true` or `false` was misspelled'
    ],
    fixCode: '{{ true }} or {{ false }}',
    fixComment: 'Use the literals `true` or `false` (lowercase)',
    suggestion: 'In Nunjucks, booleans are lowercase: `true` and `false`',
    subjectFrom: null
  }
} as const satisfies Record<string, ErrorDefinition>;

export type ParserErrorName = keyof typeof PARSER_ERRORS;
