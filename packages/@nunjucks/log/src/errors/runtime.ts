// biome-ignore lint/style/noExcessiveLinesPerFile: Error registry grows as new error definitions are added
import { createErrorDefinition } from './factory.ts';
import { firstCapture } from './types.ts';

const DOCS_BASE = 'https://mozilla.github.io/nunjucks/templating.html';

export const RUNTIME_ERRORS = {
  NULL_VALUE: {
    name: 'NULL_VALUE',
    message: "Cannot access '{accessPath}' on {state} '{parent}'",
    pattern: /^Cannot access '([^']+)' on (null|undefined) '([^']+)'$/iu,
    category: 'null_value',
    titleTemplate: "Cannot access '{subject}'",
    causes: [
      'The parent value `{parent}` is `null` or `undefined`',
      'A nested property was accessed before checking if it exists',
      'A function returned `undefined` instead of an object'
    ],
    fixCode: '{{ {parent}?.{accessPath} |> default("") }}',
    fixComment: 'Use optional chaining `?.` or `default()` filter to handle null safely',
    extraFrom: (groups: RegExpMatchArray) => ({ accessPath: groups[1] || '', state: groups[2] || '', parent: groups[3] || '' })
  },
  UNDEFINED_VARIABLE: createErrorDefinition({
    name: 'UNDEFINED_VARIABLE',
    message: "Variable '{name}' is not defined",
    category: 'undefined_variable',
    causes: [
      'The variable `{subject}` was not passed in the `render()` context object',
      'A typo in the variable name (case-sensitive)',
      'The variable is declared with `:=` inside a `{% scope %}` (or `{% for %}`/`{% component %}`) block but referenced outside its scope',
      'Using strict undefined mode but the value was not provided'
    ],
    fixCode: "{{ {subject} |> default('fallback') }}",
    fixComment: 'Add a default value with the `default` filter, or pass `{subject}` in the render context',
    documentationUrl: `${DOCS_BASE}#variables`
  }),
  UNDEFINED_PROPERTY: {
    name: 'UNDEFINED_PROPERTY',
    message: "Property '{property}' not found in '{parent}'",
    pattern: /^Property '([^']+)' not found in '([^']+)'$/iu,
    category: 'undefined_property',
    titleTemplate: "Property '{subject}' not found in '{parent}'",
    causes: [
      'The property `{property}` does not exist on `{parent}`',
      'A typo in the property name (case-sensitive)',
      'The parent object `{parent}` is `undefined` or `null`',
      'Accessing a property of an array element that does not have that field'
    ],
    fixCode: '{{ {parent }?.{property} |> default("N/A") }}',
    fixComment: 'Use optional chaining `?.` or `default()` to handle missing properties gracefully',
    extraFrom: (groups: RegExpMatchArray) => ({ property: groups[1] || '', parent: groups[2] || '' })
  },
  UNDEFINED_FUNCTION: createErrorDefinition({
    name: 'UNDEFINED_FUNCTION',
    message: "Function '{name}' is not defined",
    category: 'undefined_function',
    causes: [
      'The function `{subject}` was not registered with `env.addGlobal()`',
      'You may have meant a filter - check if `{subject}` is registered with `env.addFilter()`',
      'A typo in the function name (case-sensitive)',
      'Missing import - the function may live in another module'
    ],
    fixCode: "env.addGlobal('{subject}', function() { /* ... */ })",
    fixComment: 'Register the missing function globally on the environment before rendering'
  }),
  NOT_A_FUNCTION: createErrorDefinition({
    name: 'NOT_A_FUNCTION',
    message: "'{name}' is not a function",
    category: 'sandbox_blocked',
    causes: [
      'Tried to call `{subject}` but it is not a function (e.g. string, number, undefined)',
      'The variable `{subject}` contains the wrong data type',
      'In sandbox mode, certain global functions are blocked (e.g. eval, Function)'
    ],
    fixCode: "{{ typeof {subject} === 'function' ? {subject}() : '' }}",
    fixComment: 'Add a type check before calling, or use `if` to conditionally invoke'
  }),
  UNDEFINED_BLOCK: createErrorDefinition({
    name: 'UNDEFINED_BLOCK',
    message: 'Undefined block: {name}',
    category: 'undefined_block',
    causes: [
      'The child template overrides block `{subject}`, but the parent template never defines it',
      'The block name `{subject}` may be misspelled in either the child or parent template',
      'The template may be extending the wrong parent file',
      'The parent file failed to load and is empty'
    ],
    fixCode: '{% extends "base.njk" %}\n\n{% block content %}\n  Your content here\n{% endblock %}',
    fixComment: 'Either rename the block or add the corresponding block to the parent template'
  }),
  UNDEFINED_FILTER: createErrorDefinition({
    name: 'UNDEFINED_FILTER',
    message: "Filter '{name}' is not defined",
    category: 'undefined_filter',
    causes: [
      'The filter `{subject}` was not registered with `env.addFilter()`',
      'A typo in the filter name (case-sensitive)',
      'The input value is `undefined` - check the variable being filtered exists',
      'You may have meant a global function - check `env.addGlobal()`'
    ],
    fixCode: "env.addFilter('{subject}', function(value) { return value; })",
    fixComment: 'Register the missing filter on the environment before rendering',
    documentationUrl: `${DOCS_BASE}#filters`
  }),
  UNDEFINED_TEST: createErrorDefinition({
    name: 'UNDEFINED_TEST',
    message: "Test '{name}' is not defined",
    category: 'undefined_test',
    causes: [
      'The test `{subject}` was not registered with `env.addTest()`',
      'A typo in the test name (case-sensitive)',
      'Built-in tests like `defined`, `undefined`, `null` may be what you want'
    ],
    fixCode: "env.addTest('{subject}', function(value) { return /* boolean */ false; })",
    fixComment: 'Register the missing test on the environment'
  }),
  UNKNOWN_BLOCK_RUNTIME: {
    name: 'UNKNOWN_BLOCK_RUNTIME',
    message: 'unknown block "{name}"',
    pattern: /^unknown block "([^"]+)"$|parent has no block/iu,
    category: 'undefined_block',
    titleTemplate: "Block '{subject}' does not exist in the parent template",
    causes: [
      'The child template overrides block `{subject}`, but the parent template never defines it',
      'The block name `{subject}` may be misspelled in either the child or parent template',
      'The template may be extending the wrong parent file',
      '`{{ super() }}` is being called but the parent block does not exist'
    ],
    fixCode: '{% block content %}\n  {{ super() }}\n  Additional child content\n{% endblock %}',
    fixComment: 'Rename the child block or remove the `super()` call',
    subjectFrom: firstCapture
  },
  DUPLICATE_BLOCK: createErrorDefinition({
    name: 'DUPLICATE_BLOCK',
    message: 'Block "{name}" defined more than once',
    category: 'duplicate_block',
    causes: [
      'The block `{subject}` is defined multiple times in the same template',
      'A copy-paste error left two block declarations with the same name',
      'The template is being compiled twice (e.g. included and extended simultaneously)'
    ],
    fixCode: "{% block content %}{% endblock %}",
    fixComment: 'Remove or rename the duplicate block'
  }),
  NO_SUPER_BLOCK: {
    name: 'NO_SUPER_BLOCK',
    message: 'No super block available',
    pattern: /no super block available|called super\(\) in a block without parent/iu,
    category: 'no_super_block',
    titleTemplate: "Cannot call super() - parent has no block",
    causes: [
      '`super()` was called inside block `{subject}` but the parent template does not define it',
      'The template is being rendered without extending a parent',
      'The parent block was removed or renamed in the parent file'
    ],
    fixCode: '{% block {subject} %}\n  {% if false %}{{ super() }}{% endif %}\n  Your content\n{% endblock %}',
    fixComment: 'Guard the `super()` call with an `{% if %}` or remove it'
  },
  IN_OPERATOR: {
    name: 'IN_OPERATOR',
    message: "Cannot use 'in' operator to search for '{key}' in {type}",
    pattern: /^Cannot use 'in' operator to search for '([^']+)' in (.+)$/iu,
    category: 'operator_error',
    titleTemplate: "Cannot use 'in' operator to search for '{subject}'",
    causes: [
      'The `in` operator only works with **objects** and **arrays**',
      'Tried to check membership on a string, number, boolean, or null',
      'The right-hand side of `in` is not a collection'
    ],
    fixCode: '{{ ["a", "b", "c"] |> contains("a") }}',
    fixComment: 'Use the `contains` filter or check `is in array` for arrays',
    subjectFrom: (groups: RegExpMatchArray) => `${groups[1]} in ${groups[2]}`
  },
  TIMEOUT: {
    name: 'TIMEOUT',
    message: 'Template rendering timed out after {ms}ms',
    pattern: /^Template rendering timed out after (\d+)ms$/iu,
    category: 'timeout_error',
    titleTemplate: 'Template rendering timed out',
    causes: [
      'The template **took too long** to execute',
      'An infinite loop in the template logic (e.g. recursive macro)',
      'Large data processing in template (e.g. nested loops over millions of items)',
      'A blocking operation that does not resolve'
    ],
    fixCode: '{{ env.opts.executionTimeout = 60000; /* 60s */ }}',
    fixComment: 'Increase the `executionTimeout` config or simplify the template',
    subjectFrom: null
  },
  KEY_NOT_FOUND: createErrorDefinition({
    name: 'KEY_NOT_FOUND',
    message: "Key '{key}' not found",
    category: 'key_not_found',
    causes: [
      'The key `{subject}` does not exist on the object',
      'A typo in the key name',
      'Using strict mode when the key is optional'
    ],
    fixCode: '{{ object?.{subject} |> default("missing") }}',
    fixComment: 'Use optional chaining or provide a default value'
  }),
  INVALID_LOOKUP: {
    name: 'INVALID_LOOKUP',
    message: 'expected name as lookup value after {marker} on {target}, got {value}',
    pattern: /expected name as lookup value after (dot|\?\.) on (.+), got (.+)$/iu,
    category: 'invalid_lookup',
    titleTemplate: "Invalid property access: {subject}",
    causes: [
      'Invalid character `{marker}` used after a dot (e.g. `obj.[key]`)',
      'Mixed bracket and dot notation in an invalid way',
      'The expression after the dot is not a valid identifier or string'
    ],
    fixCode: "{{ {target}.key }} or {{ {target}['key'] }}",
    fixComment: 'Use either dot notation OR bracket notation, never mixed',
    subjectFrom: firstCapture
  },
  UNDEFINED_VALUE_MATCH: createErrorDefinition({
    name: 'UNDEFINED_VALUE_MATCH',
    message: 'Attempted to output undefined value',
    category: 'undefined_value',
    causes: [
      'A nested property access returned `null` or `undefined`',
      'An array index is out of bounds',
      'An object property does not exist',
      'A function call returned nothing'
    ],
    fixCode: "{{ object?.prop |> default('N/A') }}",
    fixComment: 'Use optional chaining `?.` and the `default` filter to handle missing values'
  }),
  CALL_MATCH: createErrorDefinition({
    name: 'CALL_MATCH',
    message: 'Unable to call',
    category: 'undefined_function',
    causes: [
      'The function does not exist in the current context',
      'The function name is misspelled',
      'A filter or global was not registered',
      'The value being called is not actually a function'
    ],
    fixCode: 'env.addGlobal("funcName", function(arg) { /* ... */ })',
    fixComment: 'Register the function with `addGlobal` before rendering'
  }),
  OUTPUT_MATCH: createErrorDefinition({
    name: 'OUTPUT_MATCH',
    message: 'Attempted to output',
    category: 'undefined_value',
    causes: [
      'The template tried to output a value that was `undefined`',
      'A property access on a missing object returned `undefined`',
      'Using `undefined: "strict"` mode caught an undefined reference'
    ],
    fixCode: "{{ value |> default('No value') }}",
    fixComment: 'Provide a default value with the `default` filter'
  }),
  RESERVED_KEYWORD: {
    name: 'RESERVED_KEYWORD',
    message: "Cannot use reserved {type} '{name}'",
    pattern: /^Cannot use reserved (.+) '([^']+)'$/iu,
    category: 'reserved_keyword',
    titleTemplate: "Cannot use reserved keyword '{subject}'",
    causes: [
      'Used a **reserved JavaScript or nunjucks keyword** as a custom name',
      'Trying to override built-in names like `if`, `for`, `block`, `component`',
      'The reserved keyword conflicts with parser internals'
    ],
    fixCode: "env.addFilter('my{subject}', function(value) { /* ... */ })",
    fixComment: 'Choose a different name with a prefix or suffix to avoid the conflict',
    subjectFrom: null
  },
  RESERVED_KEYWORD_CONTEXT: {
    name: 'RESERVED_KEYWORD_CONTEXT',
    message: "Cannot use reserved keyword '{name}' outside of its intended context",
    pattern: /reserved keyword.*context|cannot use.*reserved keyword|slot.*only available|only available inside.*component/iu,
    category: 'reserved_keyword_context',
    titleTemplate: "Cannot use reserved keyword '{subject}' outside of its intended context",
    causes: [
      '`{subject}` is a **reserved keyword** with special context requirements',
      'Only available in specific template constructs'
    ],
    fixCode: 'Use {subject} only in its intended context',
    fixComment: 'Review when {subject} can be used',
    subjectFrom: firstCapture
  },
  ASSERT_TYPE_ERROR: createErrorDefinition({
    name: 'ASSERT_TYPE_ERROR',
    message: 'Invalid type assertion',
    category: 'type_error',
    causes: [
      'An internal type assertion failed in the compiler',
      'The AST contains an unexpected node shape',
      'This indicates a bug in nunjucks itself'
    ],
    fixCode: '/* Please report this as a bug at https://github.com/mozilla/nunjucks/issues */',
    fixComment: 'This is a nunjucks internal error - not caused by your template',
    documentationUrl: 'https://github.com/mozilla/nunjucks/issues'
  }),
  UNAVAILABLE_IN_ENV: createErrorDefinition({
    name: 'UNAVAILABLE_IN_ENV',
    message: 'not available in this environment',
    category: 'unavailable',
    causes: [
      'The environment was created without registering this filter or test',
      'A custom environment is missing the filter/test handler'
    ],
    fixCode: 'env.addFilter(\'{name}\', function(value) { return value; })',
    fixComment: 'Register the missing filter with `env.addFilter()` or test with `env.addTest()`'
  }),
  EXEC_EXPRESSION_ERROR: createErrorDefinition({
    name: 'EXEC_EXPRESSION_ERROR',
    message: 'Exec expression failed: {detail}',
    category: 'runtime_error',
    causes: [
      'Variable referenced in `{% exec %}` was not passed to the render context',
      'The expression calls a method on a value that does not support it',
      'Data preparation should happen in your **controller** before render'
    ],
    fixCode: '// Controller — before render():\nconst items = prepareItems();\nrender(template, { items })',
    fixComment: 'Use {% exec %} only for rendering state. Move data logic to your controller.',
    extraFrom: (groups: RegExpMatchArray) => ({ detail: groups[1] || '' })
  })
} as const;

export type RuntimeErrorName = keyof typeof RUNTIME_ERRORS;
