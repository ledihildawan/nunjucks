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
    pattern: PATTERNS.SANDBOX_PROTO_ACCESS,
    category: 'sandbox_blocked',
    subjectFrom: null,
    causes: [
      'Attempted to access **undefined variable** in sandbox mode',
      'Accessing properties on undefined in sandboxed template'
    ],
    fixCode: '// Define the variable in render context',
    fixComment: '// Pass the variable in the context object'
  },
  {
    pattern: PATTERNS.SANDBOX_TIMEOUT,
    category: 'timeout_error',
    subjectFrom: null,
    causes: [
      'Template execution **timed out**',
      'Infinite loop or large data processing'
    ],
    fixCode: '// Increase executionTimeout or optimize template',
    fixComment: '// Set executionTimeout to a higher value or simplify template'
  },
  {
    pattern: PATTERNS.SANDBOX_CONTEXT_ERROR,
    category: 'sandbox_blocked',
    subjectFrom: null,
    causes: [
      'Attempted to access or modify **sandboxed context**',
      'Template tried to use restricted functionality'
    ],
    fixCode: '// Disable sandbox or use allowed operations',
    fixComment: '// Sandbox mode restricts certain operations'
  },
  {
    pattern: PATTERNS.NOT_A_FUNCTION,
    category: 'sandbox_blocked',
    subjectFrom: 'undefinedName',
    causes: [
      '**Calling a non-function value**',
      'Variable contains wrong data type',
      'In sandbox mode, restricted operations may cause this error'
    ],
    fixCode: "// Check variable type before calling\nconsole.log(typeof variable)",
    fixComment: '// Verify the variable type or disable sandbox'
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
    pattern: PATTERNS.EXPECTED_VARIABLE_END,
    category: 'syntax_error',
    subjectFrom: null,
    causes: [
      'Missing closing `}}` in variable expression',
      'Unclosed variable like `{{ value`'
    ],
    fixCode: '{{ value }}  // Close with }}',
    fixComment: '// Add closing }} to the variable'
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
      '`super()` called in block {subject} but parent has no block',
      'Using `super()` in a block with no **parent equivalent**',
      'Block override without a corresponding **parent block**'
    ],
    fixCode: '{% block {subject} %}...{% endblock %}',
    fixComment: '// Remove super() or use without super()'
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
    pattern: PATTERNS.IMPORT_ERROR,
    category: 'import_error',
    subjectFrom: null,
    causes: [
      '**Import failed** - template could not be loaded',
      'Module **not found** or path is incorrect',
      'Check **file path** in import statement'
    ],
    fixCode: '{% import "correct-path/template.njk" as mod %}',
    fixComment: '// Verify import path exists'
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
  },
  {
    pattern: PATTERNS.TIMEOUT_ERROR,
    category: 'timeout_error',
    subjectFrom: null,
    causes: [
      'Template **took too long** to execute',
      'Infinite loop in template',
      'Large data processing in template'
    ],
    fixCode: '// Increase timeout or optimize template',
    fixComment: '// Set executionTimeout to a higher value or optimize template'
  },
  {
    pattern: PATTERNS.SANDBOX_CONTEXT_MODIFY,
    category: 'sandbox_blocked',
    subjectFrom: null,
    causes: [
      'Attempted to modify **sandboxed context**',
      'Setting globals or protected keys in sandbox mode'
    ],
    fixCode: '// Disable sandbox or use allowed keys',
    fixComment: '// Remove the set statement or disable sandbox mode'
  },
  {
    pattern: PATTERNS.BLOCKED_CONTEXT_KEYS,
    category: 'security_error',
    subjectFrom: null,
    causes: [
      'Context contains **blocked keys** like __proto__',
      'Dangerous keys detected in render context'
    ],
    fixCode: '// Remove blocked keys from context',
    fixComment: '// Clean the context before passing to render'
  },
  {
    pattern: PATTERNS.DANGEROUS_CONTEXT_VALUES,
    category: 'security_error',
    subjectFrom: null,
    causes: [
      'Context contains **dangerous values** like eval or Function',
      'Potentially malicious functions in context'
    ],
    fixCode: '// Remove dangerous functions from context',
    fixComment: '// Clean the context before passing to render'
  },
  {
    pattern: PATTERNS.DANGEROUS_TEMPLATE_CODE,
    category: 'security_error',
    subjectFrom: null,
    causes: [
      'Template contains **dangerous code patterns**',
      'Attempted to access global objects'
    ],
    fixCode: '// Remove dangerous code from template',
    fixComment: '// Do not use eval, Function, or access global in templates'
  },
  {
    pattern: PATTERNS.TEMPLATE_SIZE_EXCEEDED,
    category: 'validation_error',
    subjectFrom: null,
    causes: [
      'Template **exceeds maximum allowed size**',
      'Template is too large for processing'
    ],
    fixCode: '// Increase maxTemplateSize or split template',
    fixComment: '// Set maxTemplateSize to a higher value'
  },
  {
    pattern: PATTERNS.INVALID_CONFIG,
    category: 'validation_error',
    subjectFrom: null,
    causes: [
      'Invalid **configuration value**',
      'Negative timeout or size values are not allowed'
    ],
    fixCode: '// Set executionTimeout and maxTemplateSize to >= 0',
    fixComment: '// Use non-negative values for timeout and size'
  },
  {
    pattern: PATTERNS.TEMPLATE_MUST_BE_STRING,
    category: 'validation_error',
    subjectFrom: null,
    sourceFromStack: true,
    causes: [
      'Template must be a **string**, got null/undefined',
      'Passed template is not a valid string'
    ],
    fixCode: '// Pass a valid template string',
    fixComment: '// Ensure template parameter is a string'
  },
  {
    pattern: PATTERNS.JS_STACK_SOURCE,
    category: 'js_stack_source',
    subjectFrom: null,
    sourceFromStack: true,
    causes: [
      '**Template parameter** is null or invalid',
      'Passed template is not a valid string'
    ],
    fixCode: '// Pass a valid template string',
    fixComment: '// Ensure template parameter is a string'
  },
  {
    pattern: PATTERNS.TEMPLATE_NULL,
    category: 'invalid_template',
    subjectFrom: null,
    causes: [
      'Template is **null** or **undefined**',
      'Passed template parameter is not a valid string'
    ],
    fixCode: '// Pass a valid template string',
    fixComment: '// Ensure template is a non-null string'
  },
  {
    pattern: PATTERNS.GROUPBY_TYPE_ERROR,
    category: 'groupby_type_error',
    subjectFrom: null,
    causes: [
      'Groupby attribute **resolved to undefined**',
      'Property used in groupby does not exist'
    ],
    fixCode: '// Use an attribute that exists on the items',
    fixComment: '// Check that the attribute exists on all items'
  },
  {
    pattern: PATTERNS.DICTSORT_VALUE_ERROR,
    category: 'dictsort_value_error',
    subjectFrom: null,
    causes: [
      '**Dictsort filter** requires an **object** input',
      'Passed value is not an object'
    ],
    fixCode: '{{ data |> dictsort }}  // Use with objects',
    fixComment: '// Use dictsort with an object'
  },
  {
    pattern: PATTERNS.DICTSORT_BY_ERROR,
    category: 'dictsort_by_error',
    subjectFrom: null,
    causes: [
      '**Dictsort filter** `by` parameter must be "key" or "value"',
      'Invalid value passed to dictsort by parameter'
    ],
    fixCode: '{{ data |> dictsort(false, "key") }}  // or "value"',
    fixComment: '// Use "key" or "value" for the by parameter'
  },
  {
    pattern: PATTERNS.SORT_TYPE_ERROR,
    category: 'sort_type_error',
    subjectFrom: null,
    causes: [
      'Sort attribute **resolved to undefined**',
      'Property used in sort does not exist'
    ],
    fixCode: '// Use an attribute that exists on the items',
    fixComment: '// Check that the attribute exists on all items'
  },
  {
    pattern: PATTERNS.RESERVED_KEYWORD,
    category: 'reserved_keyword',
    subjectFrom: null,
    causes: [
      'Used a **reserved keyword** as filter or global name',
      'Cannot override built-in JavaScript or nunjucks keywords'
    ],
    fixCode: '// Use a different name for your filter or global',
    fixComment: '// Choose a name that is not a reserved keyword'
  },
  {
    pattern: PATTERNS.UNKNOWN_BLOCK_RUNTIME,
    category: 'undefined_block',
    subjectFrom: null,
    causes: [
      '**Block** referenced in template does not exist',
      'Block name misspelled or not defined'
    ],
    fixCode: '<!-- Define the block in parent template -->',
    fixComment: '// Ensure the block is defined in an extended template'
  },
  {
    pattern: PATTERNS.NO_SUPER_BLOCK,
    category: 'no_super_block',
    subjectFrom: null,
    causes: [
      'Called **super()** on a block with no parent',
      'Block has no parent template to inherit from'
    ],
    fixCode: '<!-- Remove super() call or extend a parent template -->',
    fixComment: '// Remove super() or ensure template extends a parent with the block'
  },
  {
    pattern: PATTERNS.PARSER_EXPECTED,
    category: 'syntax_error',
    subjectFrom: null,
    causes: [
      '**Parser expected** a different token',
      'Missing or misplaced token in template'
    ],
    fixCode: '<!-- Check template syntax around the error line -->',
    fixComment: '// Review the template syntax at the error location'
  },
  {
    pattern: PATTERNS.PARSER_EXPECTED_IN,
    category: 'syntax_error',
    subjectFrom: null,
    causes: [
      '**For loop** missing **in** keyword',
      'For loop syntax is incorrect'
    ],
    fixCode: '{% for item in items %}...{% endfor %}',
    fixComment: '// Use correct for loop syntax: for item in items'
  },
  {
    pattern: PATTERNS.PARSER_VARIABLE_NAME,
    category: 'syntax_error',
    subjectFrom: null,
    causes: [
      '**Variable name expected** in context',
      'Missing or invalid variable identifier'
    ],
    fixCode: '{% set validName = value %}',
    fixComment: '// Use a valid variable name ( alphanumeric and underscore)'
  },
  {
    pattern: PATTERNS.PARSER_TAG_NAME,
    category: 'syntax_error',
    subjectFrom: null,
    causes: [
      '**Tag name expected** but not found',
      'Missing tag identifier'
    ],
    fixCode: '{% if condition %}...{% endif %}',
    fixComment: '// Ensure tag has a valid name'
  },
  {
    pattern: PATTERNS.ASSERT_TYPE_ERROR,
    category: 'type_error',
    subjectFrom: null,
    causes: [
      '**Type assertion failed** in compiled code',
      'Internal nunjucks type mismatch'
    ],
    fixCode: '// This is likely a nunjucks internal error',
    fixComment: '// Report this as a bug if it occurs'
  },
  {
    pattern: PATTERNS.INVALID_BOOLEAN,
    category: 'syntax_error',
    subjectFrom: null,
    causes: [
      '**Invalid boolean** value in template',
      'Template contains non-boolean where boolean expected'
    ],
    fixCode: '{{ true }} or {{ false }}',
    fixComment: '// Use valid boolean values: true or false'
  },
  {
    pattern: PATTERNS.PARSER_EXPRESSION,
    category: 'syntax_error',
    subjectFrom: null,
    causes: [
      '**Expression expected** but not found',
      'Missing expression in template'
    ],
    fixCode: '{{ someExpression }}',
    fixComment: '// Add a valid expression'
  },
  {
    pattern: PATTERNS.CONTAINER_FACTORY,
    category: 'config_error',
    subjectFrom: null,
    causes: [
      '**Container factory** must be a function',
      'Registered container factory is not callable'
    ],
    fixCode: 'container.register("name", () => new MyClass())',
    fixComment: '// Pass a function that returns an instance'
  },
  {
    pattern: PATTERNS.CONTAINER_NOT_REGISTERED,
    category: 'config_error',
    subjectFrom: null,
    causes: [
      '**Container** not registered',
      'Requested container has not been registered'
    ],
    fixCode: 'container.register("name", () => new MyClass())',
    fixComment: '// Register the container before resolving'
  },
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
