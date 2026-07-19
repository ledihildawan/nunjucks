import type { ErrorDefinition, SubjectExtractor } from './types.ts';

const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

export const PARSER_ERRORS = {
  SYNTAX_ERROR: {
    name: 'SYNTAX_ERROR',
    message: 'Syntax error',
    pattern: /^Unexpected token|unexpected end of file|unexpected end of template|unexpected token:|parse error|Parse error|Unexpected end of input|^expected arguments$|^expected (?:comma|right bracket|block end|endtry|elif|else|endif)|^tag name expected|^invalid boolean|^expected expression, got end of file|^expected [a-zA-Z]+(?:, got [a-zA-Z.]+)?$/i,
    category: 'syntax_error',
    titleTemplate: "Template syntax error",
    causes: [
      'Missing closing tag (`{{ endif }}`, `{% endfor %}`)',
      '**Mismatched quotes** or brackets',
      '**Unclosed** array/object brackets'
    ],
    fixCode: "{{ [1, 2, 3] |> join(',') }}",
    fixComment: 'Check brackets, quotes, and tag closures',
    subjectFrom: null
  },
  PARSER_UNEXPECTED_TOKEN: {
    name: 'PARSER_UNEXPECTED_TOKEN',
    message: "Unexpected token '{token}' while parsing",
    pattern: /^Unexpected token '([^']+)' while parsing$/i,
    category: 'syntax_error',
    causes: [
      '**Unexpected token** in template'
    ],
    fixCode: 'Check template syntax around the error location',
    fixComment: 'Review the template syntax',
    subjectFrom: firstCapture
  },
  PARSER_EXPECTED: {
    name: 'PARSER_EXPECTED',
    message: 'expected {expected}',
    pattern: /^expected (.+)$/i,
    category: 'syntax_error',
    causes: [
      '**Parser expected** a different token',
      'Missing or misplaced token in template'
    ],
    fixCode: 'Check template syntax around the error line',
    fixComment: 'Review the template syntax at the error location',
    subjectFrom: firstCapture
  },
  PARSER_EXPECTED_IN: {
    name: 'PARSER_EXPECTED_IN',
    message: 'expected "in" keyword for loop',
    pattern: /parseFor: expected "in" keyword for loop|^expected "in" keyword for loop$/i,
    category: 'syntax_error',
    causes: [
      '**For loop** missing **in** keyword',
      'For loop syntax is incorrect'
    ],
    fixCode: '{% for item in items %}...{% endfor %}',
    fixComment: 'Use correct for loop syntax: for item in items',
    subjectFrom: null
  },
  PARSER_VARIABLE_NAME: {
    name: 'PARSER_VARIABLE_NAME',
    message: 'variable name expected',
    pattern: /(?:parseBlock|parseFor): variable name expected|^variable name expected$/i,
    category: 'syntax_error',
    causes: [
      '**Variable name expected** in context',
      'Missing or invalid variable identifier'
    ],
    fixCode: '{% set validName = value %}',
    fixComment: 'Use a valid variable name ( alphanumeric and underscore)',
    subjectFrom: null
  },
  PARSER_TAG_NAME: {
    name: 'PARSER_TAG_NAME',
    message: 'tag name expected',
    pattern: /^tag name expected$|parse(?:Block|From|TemplateRef|FilterStatement|If|Import|Include): expected [a-zA-Z]+$/i,
    category: 'syntax_error',
    causes: [
      '**Tag name expected** but not found',
      'Missing tag identifier'
    ],
    fixCode: '{% if condition %}...{% endif %}',
    fixComment: 'Ensure tag has a valid name',
    subjectFrom: null
  },
  PARSER_EXPRESSION: {
    name: 'PARSER_EXPRESSION',
    message: 'expected expression',
    pattern: /^expected expression, got end of file$|parseAggregate: expected (?:comma|colon)/i,
    category: 'syntax_error',
    causes: [
      '**Expression expected** but not found',
      'Missing expression in template'
    ],
    fixCode: '{{ someExpression }}',
    fixComment: 'Add a valid expression',
    subjectFrom: null
  },
  PARSER_ERROR: {
    name: 'PARSER_ERROR',
    message: 'Unexpected value while parsing',
    pattern: /^Unexpected value while parsing$/i,
    category: 'syntax_error',
    causes: [
      '**Unexpected value** while parsing'
    ],
    fixCode: 'Check template syntax',
    fixComment: 'Review the template syntax',
    subjectFrom: null
  },
  PARSER_PUSH_TOKEN: {
    name: 'PARSER_PUSH_TOKEN',
    message: 'can only push one token',
    pattern: /can only push one token/i,
    category: 'syntax_error',
    causes: [
      '**Parser error** - can only push one token'
    ],
    fixCode: 'Check template syntax',
    fixComment: 'Review the template syntax',
    subjectFrom: null
  },
  EXPECTED_VARIABLE_END: {
    name: 'EXPECTED_VARIABLE_END',
    message: 'expected variable end',
    pattern: /^expected variable end$/i,
    category: 'syntax_error',
    causes: [
      'Missing closing `}}` in variable expression',
      'Unclosed variable like `{{ value`'
    ],
    fixCode: '{{ value }}',
    fixComment: 'Add closing }} to the variable',
    subjectFrom: null
  },
  UNKNOWN_BLOCK_TAG: {
    name: 'UNKNOWN_BLOCK_TAG',
    message: "unknown block tag: {tag}",
    pattern: /^unknown block tag: (.+)$/i,
    category: 'unknown_block_tag',
    titleTemplate: "Unknown tag or block: {subject}",
    causes: [
      '**Unmatched** closing tag (e.g. `{% endif %}` without `{% if %}`)',
      '**Typo** in block tag name'
    ],
    fixCode: "{% if condition %}...{% endif %}",
    fixComment: 'Ensure all block tags are properly opened and closed',
    subjectFrom: firstCapture
  },
  INVALID_BOOLEAN: {
    name: 'INVALID_BOOLEAN',
    message: 'invalid boolean',
    pattern: /^invalid boolean(?:: .+)?$/i,
    category: 'syntax_error',
    causes: [
      '**Invalid boolean** value in template',
      'Template contains non-boolean where boolean expected'
    ],
    fixCode: '{{ true }} or {{ false }}',
    fixComment: 'Use valid boolean values: true or false',
    subjectFrom: null
  }
} as const satisfies Record<string, ErrorDefinition>;

export type ParserErrorName = keyof typeof PARSER_ERRORS;
