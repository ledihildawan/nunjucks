import type { ErrorDefinition, SubjectExtractor, ExtraExtractor } from './types.ts';

const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

const DOCS_BASE = 'https://mozilla.github.io/nunjucks/templating.html';

export const RUNTIME_ERRORS = {
  NULL_VALUE: {
    name: 'NULL_VALUE',
    message: "Cannot access '{accessPath}' on {state} '{parent}'",
    pattern: /^Cannot access '([^']+)' on (null|undefined) '([^']+)'$/i,
    category: 'null_value',
    titleTemplate: "Cannot access '{subject}'",
    causes: [
      'The parent value `{parent}` is `null` or `undefined`',
      'A nested property was accessed before checking if it exists',
      'A function returned `undefined` instead of an object'
    ],
    fixCode: '{{ {parent}?.{accessPath} |> default("") }}',
    fixComment: 'Use optional chaining `?.` or `default()` filter to handle null safely',
    suggestion: 'Run `{{ {parent} |> dump }}` in a debug template to inspect the value at runtime',
    subjectFrom: firstCapture,
    extraFrom: (groups) => ({ accessPath: groups[1] || '', state: groups[2] || '', parent: groups[3] || '' })
  },
  UNDEFINED_VARIABLE: {
    name: 'UNDEFINED_VARIABLE',
    message: "Variable '{name}' is not defined",
    pattern: /^Variable '([^']+)' is not defined$/i,
    category: 'undefined_variable',
    titleTemplate: "Variable '{subject}' is not defined",
    causes: [
      'The variable `{subject}` was not passed in the `render()` context object',
      'A typo in the variable name (case-sensitive)',
      'The variable is defined inside a `{% set %}` block but referenced outside its scope',
      'Using strict undefined mode but the value was not provided'
    ],
    fixCode: "{{ {subject} |> default('fallback') }}",
    fixComment: 'Add a default value with the `default` filter, or pass `{subject}` in the render context',
    suggestion: 'Print `{{ {subject} |> dump }}` in a debug template to see all available variables and their values',
    documentationUrl: `${DOCS_BASE}#variables`,
    subjectFrom: firstCapture
  },
  UNDEFINED_PROPERTY: {
    name: 'UNDEFINED_PROPERTY',
    message: "Property '{property}' not found in '{parent}'",
    pattern: /^Property '([^']+)' not found in '([^']+)'$/i,
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
    suggestion: 'Inspect the data structure with `{{ {parent} |> dump(2) }}` to see available properties',
    subjectFrom: firstCapture,
    extraFrom: (groups) => ({ property: groups[1] || '', parent: groups[2] || '' })
  },
  UNDEFINED_FUNCTION: {
    name: 'UNDEFINED_FUNCTION',
    message: "Function '{name}' is not defined",
    pattern: /^Function '([^']+)' is not defined$/i,
    category: 'undefined_function',
    titleTemplate: "Function '{subject}' is not defined",
    causes: [
      'The function `{subject}` was not registered with `env.addGlobal()`',
      'You may have meant a filter - check if `{subject}` is registered with `env.addFilter()`',
      'A typo in the function name (case-sensitive)',
      'Missing import - the function may live in another module'
    ],
    fixCode: "env.addGlobal('{subject}', function() { /* ... */ })",
    fixComment: 'Register the missing function globally on the environment before rendering',
    suggestion: 'Search your codebase for `addGlobal` to see where functions are registered and verify setup order',
    subjectFrom: firstCapture
  },
  NOT_A_FUNCTION: {
    name: 'NOT_A_FUNCTION',
    message: "'{name}' is not a function",
    pattern: /^'([^']+)' is not a function$/i,
    category: 'sandbox_blocked',
    titleTemplate: "'{subject}' is not a function",
    causes: [
      'Tried to call `{subject}` but it is not a function (e.g. string, number, undefined)',
      'The variable `{subject}` contains the wrong data type',
      'In sandbox mode, certain global functions are blocked (e.g. eval, Function)'
    ],
    fixCode: "{{ typeof {subject} === 'function' ? {subject}() : '' }}",
    fixComment: 'Add a type check before calling, or use `if` to conditionally invoke',
    suggestion: 'Print `typeof {subject}` first to see what type it actually is',
    subjectFrom: firstCapture
  },
  UNDEFINED_BLOCK: {
    name: 'UNDEFINED_BLOCK',
    message: 'Undefined block: {name}',
    pattern: /^Undefined block: (.+)$/i,
    category: 'undefined_block',
    titleTemplate: "Block '{subject}' does not exist in the parent template",
    causes: [
      'The child template overrides block `{subject}`, but the parent template never defines it',
      'The block name `{subject}` may be misspelled in either the child or parent template',
      'The template may be extending the wrong parent file',
      'The parent file failed to load and is empty'
    ],
    fixCode: '{% extends "base.njk" %}\n\n{% block content %}\n  Your content here\n{% endblock %}',
    fixComment: 'Either rename the block or add the corresponding block to the parent template',
    suggestion: 'Open the parent template and check the list of `{% block %}` declarations',
    subjectFrom: firstCapture
  },
  UNDEFINED_FILTER: {
    name: 'UNDEFINED_FILTER',
    message: "Filter '{name}' is not defined",
    pattern: /^Filter '([^']+)' is not defined$/i,
    category: 'undefined_filter',
    titleTemplate: "Filter '{subject}' is not defined",
    causes: [
      'The filter `{subject}` was not registered with `env.addFilter()`',
      'A typo in the filter name (case-sensitive)',
      'The input value is `undefined` - check the variable being filtered exists',
      'You may have meant a global function - check `env.addGlobal()`'
    ],
    fixCode: "env.addFilter('{subject}', function(value) { return value; })",
    fixComment: 'Register the missing filter on the environment before rendering',
    suggestion: 'Check `env.filters` in your debugger to see all currently registered filters',
    documentationUrl: `${DOCS_BASE}#filters`,
    subjectFrom: firstCapture
  },
  UNDEFINED_TEST: {
    name: 'UNDEFINED_TEST',
    message: "Test '{name}' is not defined",
    pattern: /^Test '([^']+)' is not defined$/i,
    category: 'undefined_test',
    titleTemplate: "Test '{subject}' is not defined",
    causes: [
      'The test `{subject}` was not registered with `env.addTest()`',
      'A typo in the test name (case-sensitive)',
      'Built-in tests like `defined`, `undefined`, `null` may be what you want'
    ],
    fixCode: "env.addTest('{subject}', function(value) { return /* boolean */ false; })",
    fixComment: 'Register the missing test on the environment',
    suggestion: 'Use `is defined` or `is undefined` for the most common checks',
    subjectFrom: firstCapture
  },
  UNKNOWN_BLOCK_RUNTIME: {
    name: 'UNKNOWN_BLOCK_RUNTIME',
    message: 'unknown block "{name}"',
    pattern: /^unknown block "([^"]+)"$|parent has no block|called super\(\) in a block without parent/i,
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
    suggestion: 'Add a default `{% block X %}{% endblock %}` placeholder in the parent template to prevent this error',
    subjectFrom: firstCapture
  },
  DUPLICATE_BLOCK: {
    name: 'DUPLICATE_BLOCK',
    message: 'Block "{name}" defined more than once',
    pattern: /^Block "([^"]+)" defined more than once$/i,
    category: 'duplicate_block',
    titleTemplate: "Block '{subject}' is defined more than once",
    causes: [
      'The block `{subject}` is defined multiple times in the same template',
      'A copy-paste error left two block declarations with the same name',
      'The template is being compiled twice (e.g. included and extended simultaneously)'
    ],
    fixCode: '{% block content %}{% endblock %}',
    fixComment: 'Remove or rename the duplicate block',
    suggestion: 'Search the template for `{% block {subject} %}` and keep only one',
    subjectFrom: firstCapture
  },
  NO_SUPER_BLOCK: {
    name: 'NO_SUPER_BLOCK',
    message: 'No super block available',
    pattern: /no super block available|called super\(\) in a block without parent/i,
    category: 'no_super_block',
    titleTemplate: "Cannot call super() - parent has no block",
    causes: [
      '`super()` was called inside block `{subject}` but the parent template does not define it',
      'The template is being rendered without extending a parent',
      'The parent block was removed or renamed in the parent file'
    ],
    fixCode: '{% block {subject} %}\n  {% if false %}{{ super() }}{% endif %}\n  Your content\n{% endblock %}',
    fixComment: 'Guard the `super()` call with an `{% if %}` or remove it',
    suggestion: 'Check the inheritance chain and ensure the parent template defines the block',
    subjectFrom: firstCapture
  },
  IN_OPERATOR: {
    name: 'IN_OPERATOR',
    message: "Cannot use 'in' operator to search for '{key}' in {type}",
    pattern: /^Cannot use 'in' operator to search for '([^']+)' in (.+)$/i,
    category: 'operator_error',
    titleTemplate: "Cannot use 'in' operator to search for '{subject}'",
    causes: [
      'The `in` operator only works with **objects** and **arrays**',
      'Tried to check membership on a string, number, boolean, or null',
      'The right-hand side of `in` is not a collection'
    ],
    fixCode: '{{ ["a", "b", "c"] |> contains("a") }}',
    fixComment: 'Use the `contains` filter or check `is in array` for arrays',
    suggestion: 'For arrays use `array.indexOf(value) !== -1`. For objects use `key in object`',
    subjectFrom: (groups) => `${groups[1]} in ${groups[2]}`
  },
  TIMEOUT: {
    name: 'TIMEOUT',
    message: 'Template rendering timed out after {ms}ms',
    pattern: /^Template rendering timed out after (\d+)ms$/i,
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
    suggestion: 'Move heavy computation to pre-processing rather than rendering',
    subjectFrom: null
  },
  KEY_NOT_FOUND: {
    name: 'KEY_NOT_FOUND',
    message: "Key '{key}' not found",
    pattern: /^Key '([^']+)' not found$/i,
    category: 'key_not_found',
    titleTemplate: "Key '{subject}' not found",
    causes: [
      'The key `{subject}` does not exist on the object',
      'A typo in the key name',
      'Using strict mode when the key is optional'
    ],
    fixCode: '{{ object?.{subject} |> default("missing") }}',
    fixComment: 'Use optional chaining or provide a default value',
    suggestion: 'Use `Object.keys(obj)` to see what keys are available',
    subjectFrom: firstCapture
  },
  INVALID_LOOKUP: {
    name: 'INVALID_LOOKUP',
    message: 'expected name as lookup value after {marker} on {target}, got {value}',
    pattern: /expected name as lookup value after (dot|\?\.) on (.+), got (.+)$/i,
    category: 'invalid_lookup',
    titleTemplate: "Invalid property access: {subject}",
    causes: [
      'Invalid character `{subject}` used after a dot (e.g. `obj.[key]`)',
      'Mixed bracket and dot notation in an invalid way',
      'The expression after the dot is not a valid identifier or string'
    ],
    fixCode: "{{ {target}.key }} or {{ {target}['key'] }}",
    fixComment: 'Use either dot notation OR bracket notation, never mixed',
    suggestion: 'For dynamic keys use `obj[variable]`, for static keys use `obj.key`',
    subjectFrom: firstCapture
  },
  UNDEFINED_VALUE_MATCH: {
    name: 'UNDEFINED_VALUE_MATCH',
    message: 'Attempted to output undefined value',
    pattern: /attempted to output (?:null|undefined) value/i,
    category: 'undefined_value',
    titleTemplate: "Cannot read property '{subject}' of undefined",
    causes: [
      'A nested property access returned `null` or `undefined`',
      'An array index is out of bounds',
      'An object property does not exist',
      'A function call returned nothing'
    ],
    fixCode: "{{ object?.{subject} |> default('N/A') }}",
    fixComment: 'Use optional chaining `?.` and the `default` filter to handle missing values',
    suggestion: 'Wrap the expression in `{% if value %}{{ value }}{% endif %}` to render conditionally',
    subjectFrom: firstCapture
  },
  CALL_MATCH: {
    name: 'CALL_MATCH',
    message: 'Unable to call',
    pattern: /Unable to call `([^`]+)`/,
    category: 'undefined_function',
    titleTemplate: 'Unable to call function',
    causes: [
      'The function does not exist in the current context',
      'The function name is misspelled',
      'A filter or global was not registered',
      'The value being called is not actually a function'
    ],
    fixCode: 'env.addGlobal("funcName", function(arg) { /* ... */ })',
    fixComment: 'Register the function with `addGlobal` before rendering',
    suggestion: 'Verify the function is defined and accessible from the template scope',
    subjectFrom: firstCapture
  },
  OUTPUT_MATCH: {
    name: 'OUTPUT_MATCH',
    message: 'Attempted to output',
    pattern: /attempted to output '([^']+)'/i,
    category: 'undefined_value',
    titleTemplate: 'Attempted to output undefined value',
    causes: [
      'The template tried to output a value that was `undefined`',
      'A property access on a missing object returned `undefined`',
      'Using `undefined: "strict"` mode caught an undefined reference'
    ],
    fixCode: "{{ value |> default('No value') }}",
    fixComment: 'Provide a default value with the `default` filter',
    suggestion: 'Use `{% if value is defined %}{{ value }}{% endif %}` to guard the output',
    subjectFrom: firstCapture
  },
  RESERVED_KEYWORD: {
    name: 'RESERVED_KEYWORD',
    message: "Cannot use reserved {type} '{name}'",
    pattern: /^Cannot use reserved (.+) '([^']+)'$/i,
    category: 'reserved_keyword',
    titleTemplate: "Cannot use reserved keyword '{subject}'",
    causes: [
      'Used a **reserved JavaScript or nunjucks keyword** as a custom name',
      'Trying to override built-in names like `if`, `for`, `set`, `block`',
      'The reserved keyword conflicts with parser internals'
    ],
    fixCode: "env.addFilter('my{subject}', function(value) { /* ... */ })",
    fixComment: 'Choose a different name with a prefix or suffix to avoid the conflict',
    suggestion: 'See the list of reserved words: if, for, set, block, macro, include, extends, etc.',
    subjectFrom: null
  },
  RESERVED_KEYWORD_CONTEXT: {
    name: 'RESERVED_KEYWORD_CONTEXT',
    message: "Cannot use reserved keyword '{name}' outside of its intended context",
    pattern: /reserved keyword.*context|cannot use.*reserved keyword|caller.*only available|only available inside.*call/i,
    category: 'reserved_keyword_context',
    titleTemplate: "Cannot use reserved keyword '{subject}' outside of its intended context",
    causes: [
      '`caller` is only available inside a `{% call %}` block',
      '`super` is only available inside an overriding `{% block %}`',
      '`loop` is only available inside a `{% for %}` body',
      '`self` or other reserved context keywords are used outside their scope'
    ],
    fixCode: '{% call macro() %}{% endcall %}',
    fixComment: 'Use `{subject}` only inside the appropriate template construct',
    suggestion: 'Move `{subject}` inside the matching tag (e.g. `{{ caller() }}` inside a `{% call %}`)',
    subjectFrom: firstCapture
  },
  ASSERT_TYPE_ERROR: {
    name: 'ASSERT_TYPE_ERROR',
    message: 'Invalid type assertion',
    pattern: /^assertType: invalid type: /i,
    category: 'type_error',
    titleTemplate: 'Internal type assertion failed',
    causes: [
      'An internal type assertion failed in the compiler',
      'The AST contains an unexpected node shape',
      'This indicates a bug in nunjucks itself'
    ],
    fixCode: '/* Please report this as a bug at https://github.com/mozilla/nunjucks/issues */',
    fixComment: 'This is a nunjucks internal error - not caused by your template',
    suggestion: 'File an issue with the failing template and stack trace at the GitHub repository',
    documentationUrl: 'https://github.com/mozilla/nunjucks/issues',
    subjectFrom: null
  }
} as const satisfies Record<string, ErrorDefinition>;

export type RuntimeErrorName = keyof typeof RUNTIME_ERRORS;
