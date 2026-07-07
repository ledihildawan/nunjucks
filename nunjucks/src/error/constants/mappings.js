import { PATTERNS } from './patterns.js';

export const ERROR_RULES = [
  {
    pattern: PATTERNS.UNDEFINED_VARIABLE,
    category: 'undefined_variable',
    subjectFrom: 'undefinedName',
    causes: [
      'Variable not passed in render context',
      'Using undefined variable name',
      'Typo in variable name'
    ],
    fixCode: "{{ variable |> default('default_value') }}",
    fixComment: '// Add default filter or pass variable in context'
  },
  {
    pattern: PATTERNS.UNDEFINED_FUNCTION,
    category: 'undefined_function',
    subjectFrom: 'undefinedName',
    causes: (s) => [
      `Function '${s}' not registered with env.addGlobal()`,
      `Filter '${s}' not registered with env.addFilter()`,
      'Misspelled function or filter name'
    ],
    fixCode: (s) => `env.addGlobal('${s}', callback)`,
    fixComment: (s) => `// Register the missing function '${s}'`
  },
  {
    pattern: PATTERNS.NOT_A_FUNCTION,
    category: 'not_a_function',
    subjectFrom: 'undefinedName',
    causes: [
      'Calling a non-function value',
      'Variable contains wrong data type'
    ],
    fixCode: "// Check variable type before calling\nconsole.log(typeof variable)",
    fixComment: '// Verify the variable type'
  },
  {
    pattern: PATTERNS.SYNTAX_ERROR,
    category: 'syntax_error',
    subjectFrom: null,
    causes: [
      'Missing closing tag ({{ endif }}, {% endfor %})',
      'Mismatched quotes or brackets',
      'Unclosed array/object brackets'
    ],
    fixCode: "{{ [1, 2, 3] |> join(',') }}",
    fixComment: '// Check brackets, quotes, and tag closures'
  },
  {
    pattern: PATTERNS.UNDEFINED_FILTER,
    category: 'undefined_filter',
    subjectFrom: 'filter',
    causes: (s) => [
      `Filter '${s}' not registered with env.addFilter()`,
      'Typo in filter name'
    ],
    fixCode: (s) => `env.addFilter('${s}', fn)`,
    fixComment: (s) => `// Register the missing filter '${s}'`
  },
  {
    pattern: PATTERNS.UNDEFINED_BLOCK,
    category: 'undefined_block',
    subjectFrom: null,
    causes: [
      'Extending template without block definition',
      'Incorrect block name'
    ],
    fixCode: '{% block content %}{% endblock %}',
    fixComment: '// Define the missing block'
  },
  {
    pattern: PATTERNS.NO_SUPER_BLOCK,
    category: 'no_super_block',
    subjectFrom: 'quotes',
    causes: (s) => [
      `super() called in block '${s}' but parent has no block`,
      'Using super() in a block that has no parent equivalent',
      'Block override without corresponding parent block'
    ],
    fixCode: (s) => `{% block ${s || 'name'} %}...{% endblock %}`,
    fixComment: (s) => `// Remove super() or define parent block '${s}'`
  },
  {
    pattern: PATTERNS.CIRCULAR_INCLUDE,
    category: 'circular_include',
    subjectFrom: 'quotes',
    causes: [
      'Template includes itself (directly or indirectly)',
      'Circular dependency between templates'
    ],
    fixCode: '{% include "template.html" %}',
    fixComment: '// Remove circular include or use {% import %} for shared macros'
  },
  {
    pattern: PATTERNS.UNDEFINED_VALUE,
    category: 'undefined_value',
    subjectFrom: null,
    causes: [
      'Nested property access returned null/undefined',
      'Array index out of bounds',
      'Object property does not exist'
    ],
    fixCode: "{{ object.property |> default('default') }}",
    fixComment: '// Use default filter or safe navigation'
  },
  {
    pattern: PATTERNS.FILE_NOT_FOUND,
    category: 'file_not_found',
    subjectFrom: 'fileNotFound',
    causes: (s) => [
      `Template file '${s}' does not exist`,
      'Incorrect path in include/extends',
      'File deleted or moved'
    ],
    fixCode: (s) => `{% include "correct-path/${s}" %}`,
    fixComment: (s) => `// Verify template file path: ${s}`
  },
  {
    pattern: PATTERNS.INVALID_INCLUDE,
    category: 'invalid_include',
    subjectFrom: null,
    causes: [
      'Include path is not a string literal',
      'Variable used in include must be a string'
    ],
    fixCode: '{% include "template.html" %}',
    fixComment: '// Use string literal for include path'
  },
  {
    pattern: PATTERNS.FILESYSTEM_ERROR,
    category: 'filesystem_error',
    subjectFrom: null,
    causes: [
      'Template path points to a directory instead of file',
      'File or directory does not exist',
      'Permission denied accessing file'
    ],
    fixCode: '{% include "template.html" %}',
    fixComment: '// Verify template path is a valid file'
  }
];
