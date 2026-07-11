import { PATTERNS } from './error-patterns.js';

export const ERROR_RULES = [
  {
    pattern: PATTERNS.UNDEFINED_VALUE,
    category: 'undefined_value',
    subjectFrom: 'undefinedName',
    causes: [
      '**Nested property access** returned `null`/`undefined`',
      '**Array index** out of bounds',
      '**Object property** does not exist'
    ],
    fixCode: "{{ object.property |> default('default_value') }}",
    fixComment: '// Use default filter or safe navigation for nested properties'
  },
  {
    pattern: PATTERNS.UNDEFINED_VARIABLE,
    category: 'undefined_variable',
    subjectFrom: 'undefinedName',
    causes: [
      'Variable `{subject}` not passed in `render` context',
      '**Typo** in variable name',
      'Using an **undefined variable** name'
    ],
    fixCode: "{{ '{subject}' |> default('default_value') }}",
    fixComment: '// Add default filter or pass {subject} in context'
  },
  {
    pattern: PATTERNS.UNDEFINED_FUNCTION,
    category: 'undefined_function',
    subjectFrom: 'undefinedName',
    causes: [
      'Function `{subject}` not registered with `env.addGlobal()`',
      'Filter `{subject}` not registered with `env.addFilter()`',
      '**Misspelled** function or filter name'
    ],
    fixCode: "env.addGlobal('{subject}', callback)",
    fixComment: "// Register the missing function '{subject}'"
  },
  {
    pattern: PATTERNS.NOT_A_FUNCTION,
    category: 'not_a_function',
    subjectFrom: 'undefinedName',
    causes: [
      '**Calling a non-function value**',
      'Variable contains wrong data type'
    ],
    fixCode: "// Check variable type before calling\nconsole.log(typeof variable)",
    fixComment: '// Verify the variable type'
  },
  {
    pattern: PATTERNS.INVALID_LOOKUP,
    category: 'invalid_lookup',
    subjectFrom: 'invalidLookup',
    causes: [
      'Invalid character `{subject}` after dot (e.g. `{target}.[{subject}]`)',
      'Use **either dot** (`{target}.key`) **or bracket** (`{target}["key"]`) **notation**',
      '**Mixed notation** is not allowed'
    ],
    fixCode: "{{ {target}.key }} or {{ {target}['key'] }}",
    fixComment: '// Use dot OR bracket notation, not both'
  },
  {
    pattern: PATTERNS.DUPLICATE_BLOCK,
    category: 'duplicate_block',
    subjectFrom: 'duplicateBlock',
    causes: [
      '**Duplicate block** definition in template',
      'Block is defined multiple times'
    ],
    fixCode: "{% block content %}{% endblock %}",
    fixComment: '// Remove duplicate block definitions'
  },
  {
    pattern: PATTERNS.UNKNOWN_BLOCK_TAG,
    category: 'unknown_block_tag',
    subjectFrom: 'unknownBlockTag',
    causes: [
      '**Unmatched** closing tag (e.g. `{% endif %}` without `{% if %}`)',
      '**Typo** in block tag name'
    ],
    fixCode: "{% if condition %}...{% endif %}",
    fixComment: '// Ensure all block tags are properly opened and closed'
  },
  {
    pattern: PATTERNS.SYNTAX_ERROR,
    category: 'syntax_error',
    subjectFrom: null,
    causes: [
      'Missing closing tag (`{{ endif }}`, `{% endfor %}`)',
      '**Mismatched quotes** or brackets',
      '**Unclosed** array/object brackets'
    ],
    fixCode: "{{ [1, 2, 3] |> join(',') }}",
    fixComment: '// Check brackets, quotes, and tag closures'
  },
  {
    pattern: PATTERNS.UNDEFINED_FILTER,
    category: 'undefined_filter',
    subjectFrom: 'filter',
    causes: [
      'Filter `{subject}` not registered with `env.addFilter()`',
      '**Typo** in filter name'
    ],
    fixCode: "env.addFilter('{subject}', fn)",
    fixComment: "// Register the missing filter '{subject}'"
  },
  {
    pattern: PATTERNS.UNDEFINED_BLOCK,
    category: 'undefined_block',
    subjectFrom: null,
    causes: [
      '**Extending template** without block definition',
      'Incorrect **block name**'
    ],
    fixCode: '{% block content %}{% endblock %}',
    fixComment: '// Define the missing block'
  },
  {
    pattern: PATTERNS.NO_SUPER_BLOCK,
    category: 'no_super_block',
    subjectFrom: 'quotes',
    causes: [
      '`super()` called in block `{subject}` but parent has no block',
      'Using `super()` in a block with no **parent equivalent**',
      'Block override without a corresponding **parent block**'
    ],
    fixCode: '{% block {subject} %}...{% endblock %}',
    fixComment: "// Remove super() or define parent block '{subject}'"
  },
  {
    pattern: PATTERNS.CIRCULAR_INCLUDE,
    category: 'circular_include',
    subjectFrom: 'quotes',
    causes: [
      '**Template includes itself** (directly or indirectly)',
      '**Circular dependency** between templates'
    ],
    fixCode: '{% include "template.html" %}',
    fixComment: '// Remove circular include or use {% import %} for shared macros'
  },
  {
    pattern: PATTERNS.FILE_NOT_FOUND,
    category: 'file_not_found',
    subjectFrom: 'fileNotFound',
    causes: [
      'Template file `{subject}` **does not exist**',
      '**Incorrect path** in `include`/`extends`',
      'File **deleted or moved**'
    ],
    fixCode: '{% include "correct-path/{subject}" %}',
    fixComment: '// Verify template file path: {subject}'
  },
  {
    pattern: PATTERNS.INVALID_INCLUDE,
    category: 'invalid_include',
    subjectFrom: null,
    causes: [
      '**Include path** is not a string literal',
      'Variable used in `include` must be a **string**'
    ],
    fixCode: '{% include "template.html" %}',
    fixComment: '// Use string literal for include path'
  },
  {
    pattern: PATTERNS.FILESYSTEM_ERROR,
    category: 'filesystem_error',
    subjectFrom: null,
    causes: [
      'Template path points to a **directory** instead of a file',
      'File or directory **does not exist**',
      '**Permission denied** accessing file'
    ],
    fixCode: '{% include "template.html" %}',
    fixComment: '// Verify template path is a valid file'
  },
  {
    pattern: PATTERNS.SANDBOX_ACCESS,
    category: 'sandbox_blocked',
    subjectFrom: 'blockedKey',
    causes: [
      '**Sandbox mode** blocks access to `{subject}`',
      'Dangerous property access attempted in sandboxed template'
    ],
    fixCode: '// Remove access to blocked property or disable sandbox',
    fixComment: '// Remove access to {subject} in your template'
  },
  {
    pattern: PATTERNS.SANDBOX_SET,
    category: 'sandbox_blocked',
    subjectFrom: 'blockedKey',
    causes: [
      '**Sandbox mode** blocks setting `{subject}`',
      'Attempted to modify blocked property in sandboxed template'
    ],
    fixCode: '// Remove assignment to blocked property or disable sandbox',
    fixComment: '// Remove assignment to {subject} in your template'
  },
  {
    pattern: PATTERNS.SLICE_STEP,
    category: 'slice_error',
    subjectFrom: null,
    causes: [
      '**Slice step** cannot be zero (division by zero)',
      'Invalid slice notation: `[::0]` is not allowed'
    ],
    fixCode: '{{ list[::1] }}  // Use step of 1 or higher',
    fixComment: '// Slice step must be non-zero'
  },
  {
    pattern: PATTERNS.LIST_FILTER,
    category: 'iterable_error',
    subjectFrom: null,
    causes: [
      '**List filter** requires an **iterable** input',
      'Passed value type is not iterable (e.g., number, null)'
    ],
    fixCode: '{{ "string" | list }}  // Works with strings',
    fixComment: '// Use list filter with strings or arrays'
  },
  {
    pattern: PATTERNS.IN_OPERATOR,
    category: 'operator_error',
    subjectFrom: 'searchValue',
    causes: [
      '**In operator** only works with **objects**, not primitives',
      'Cannot search for value in **string/number/boolean**'
    ],
    fixCode: '{{ "key" in { key: "value" } }}  // Use with objects',
    fixComment: '// In operator requires an object, not a primitive'
  }
];

export const DEFAULT_CLASSIFICATION = {
  category: 'unknown',
  undefinedName: null,
  causes: [
    'Check template **syntax**',
    'Verify **variable scope**',
    'Check **render context** data'
  ],
  fixCode: '// Inspect the error message above for clues',
  fixComment: '// Review the template source and context'
};
