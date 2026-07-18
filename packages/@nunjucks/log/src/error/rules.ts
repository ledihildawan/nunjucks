import { PATTERNS } from './messages.ts';
import type { ErrorName } from './messages.ts';

type SubjectExtractor = (groups: RegExpMatchArray) => string | null;

interface Rule {
  pattern: RegExp;
  category: string;
  subjectFrom: SubjectExtractor | null;
  titleTemplate?: string;
  causes: string[];
  fixCode?: string;
  fixComment?: string;
  sourceFromStack?: boolean;
}

const undefinedNameExtractor = (groups: RegExpMatchArray): string | null => {
  return groups[1] ?? null;
};

const fileNotFoundExtractor = (groups: RegExpMatchArray): string | null => {
  return groups[1] ?? null;
};

const importErrorExtractor = (groups: RegExpMatchArray): string | null => {
  return groups[1] ?? null;
};

const undefinedBlockExtractor = (groups: RegExpMatchArray): string | null => {
  return groups[1] ?? null;
};

const duplicateBlockExtractor = (groups: RegExpMatchArray): string | null => {
  return groups[1] ?? null;
};

const unknownBlockTagExtractor = (groups: RegExpMatchArray): string | null => {
  return groups[1] ?? null;
};

const blockedKeyExtractor = (groups: RegExpMatchArray): string | null => {
  return groups[1] ?? null;
};

const filterExtractor = (groups: RegExpMatchArray): string | null => {
  return groups[1] ?? null;
};

const invalidLookupExtractor = (groups: RegExpMatchArray): string | null => {
  return groups[1] ?? null;
};

const searchValueExtractor = (groups: RegExpMatchArray): string | null => {
  return groups[1] ?? null;
};

const quotesExtractor = (groups: RegExpMatchArray): string | null => {
  return groups[1] ?? null;
};

export const RULES: Rule[] = [
  {
    pattern: PATTERNS.UNDEFINED_VALUE_MATCH,
    category: 'undefined_value',
    subjectFrom: undefinedNameExtractor,
    titleTemplate: "Cannot read property '{subject}' of undefined",
    causes: [
      '**Nested property access** returned `null`/`undefined`',
      '**Array index** out of bounds',
      '**Object property** does not exist'
    ],
    fixCode: "{{ object.property |> default('default_value') }}",
    fixComment: 'Use default filter or safe navigation for nested properties'
  },
  {
    pattern: PATTERNS.UNDEFINED_VARIABLE,
    category: 'undefined_variable',
    subjectFrom: undefinedNameExtractor,
    titleTemplate: "Variable '{subject}' is not defined",
    causes: [
      'Variable `{subject}` not passed in `render` context',
      '**Typo** in variable name',
      'Using an **undefined variable** name'
    ],
    fixCode: "{{ '{subject}' |> default('default_value') }}",
    fixComment: 'Add default filter or pass {subject} in context'
  },
  {
    pattern: PATTERNS.UNDEFINED_FUNCTION,
    category: 'undefined_function',
    subjectFrom: undefinedNameExtractor,
    titleTemplate: "Function '{subject}' is not defined",
    causes: [
      'Function `{subject}` not registered with `env.addGlobal()`',
      'Filter `{subject}` not registered with `env.addFilter()`',
      '**Misspelled** function or filter name'
    ],
    fixCode: "env.addGlobal('{subject}', callback)",
    fixComment: "Register the missing function '{subject}'"
  },
  {
    pattern: PATTERNS.SANDBOX_PROTO_ACCESS,
    category: 'sandbox_blocked',
    subjectFrom: null,
    titleTemplate: "Cannot access property in sandbox mode",
    causes: [
      'Attempted to access **undefined variable** in sandbox mode',
      'Accessing properties on undefined in sandboxed template'
    ],
    fixCode: 'Define the variable in render context',
    fixComment: 'Pass the variable in the context object'
  },
  {
    pattern: PATTERNS.SANDBOX_TIMEOUT_EXEC,
    category: 'timeout_error',
    subjectFrom: null,
    titleTemplate: "Template execution timed out",
    causes: [
      'Template execution **timed out**',
      'Infinite loop or large data processing'
    ],
    fixCode: 'Increase executionTimeout or optimize template',
    fixComment: 'Set executionTimeout to a higher value or simplify template'
  },
  {
    pattern: PATTERNS.SANDBOX_CONTEXT_ERROR,
    category: 'sandbox_blocked',
    subjectFrom: null,
    titleTemplate: "Cannot modify sandboxed context",
    causes: [
      'Attempted to access or modify **sandboxed context**',
      'Template tried to use restricted functionality'
    ],
    fixCode: 'Disable sandbox or use allowed operations',
    fixComment: 'Sandbox mode restricts certain operations'
  },
  {
    pattern: PATTERNS.NOT_A_FUNCTION,
    category: 'sandbox_blocked',
    subjectFrom: undefinedNameExtractor,
    titleTemplate: "'{subject}' is not a function",
    causes: [
      '**Calling a non-function value**',
      'Variable contains wrong data type',
      'In sandbox mode, restricted operations may cause this error'
    ],
    fixCode: "Check variable type before calling\nconsole.log(typeof variable)",
    fixComment: 'Verify the variable type or disable sandbox'
  },
  {
    pattern: PATTERNS.INVALID_LOOKUP,
    category: 'invalid_lookup',
    subjectFrom: invalidLookupExtractor,
    titleTemplate: "Invalid property access: {subject}",
    causes: [
      'Invalid character `{subject}` after dot (e.g. `{target}.[{subject}]`)',
      'Use **either dot** (`{target}.key`) **or bracket** (`{target}["key"]`) **notation**',
      '**Mixed notation** is not allowed'
    ],
    fixCode: "{{ {target}.key }} or {{ {target}['key'] }}",
    fixComment: 'Use dot OR bracket notation, not both'
  },
  {
    pattern: PATTERNS.DUPLICATE_BLOCK,
    category: 'duplicate_block',
    subjectFrom: duplicateBlockExtractor,
    titleTemplate: "Block '{subject}' is defined more than once",
    causes: [
      '**Duplicate block** definition in template',
      'Block is defined multiple times'
    ],
    fixCode: "{% block content %}{% endblock %}",
    fixComment: 'Remove duplicate block definitions'
  },
  {
    pattern: PATTERNS.UNKNOWN_BLOCK_TAG,
    category: 'unknown_block_tag',
    subjectFrom: unknownBlockTagExtractor,
    titleTemplate: "Unknown tag or block: {subject}",
    causes: [
      '**Unmatched** closing tag (e.g. `{% endif %}` without `{% if %}`)',
      '**Typo** in block tag name'
    ],
    fixCode: "{% if condition %}...{% endif %}",
    fixComment: 'Ensure all block tags are properly opened and closed'
  },
  {
    pattern: PATTERNS.EXPECTED_VARIABLE_END,
    category: 'syntax_error',
    subjectFrom: null,
    causes: [
      'Missing closing `}}` in variable expression',
      'Unclosed variable like `{{ value`'
    ],
    fixCode: '{{ value }}',
    fixComment: 'Add closing }} to the variable'
  },
  {
    pattern: PATTERNS.SYNTAX_ERROR,
    category: 'syntax_error',
    subjectFrom: null,
    titleTemplate: "Template syntax error",
    causes: [
      'Missing closing tag (`{{ endif }}`, `{% endfor %}`)',
      '**Mismatched quotes** or brackets',
      '**Unclosed** array/object brackets'
    ],
    fixCode: "{{ [1, 2, 3] |> join(',') }}",
    fixComment: 'Check brackets, quotes, and tag closures'
  },
  {
    pattern: PATTERNS.UNDEFINED_FILTER,
    category: 'undefined_filter',
    subjectFrom: filterExtractor,
    titleTemplate: "Filter '{subject}' is not defined",
    causes: [
      'Filter `{subject}` not registered with `env.addFilter()`',
      '**Typo** in filter name'
    ],
    fixCode: "env.addFilter('{subject}', fn)",
    fixComment: "Register the missing filter '{subject}'"
  },
  {
    pattern: PATTERNS.UNKNOWN_BLOCK_RUNTIME,
    category: 'undefined_block',
    subjectFrom: undefinedBlockExtractor,
    titleTemplate: "Block '{subject}' does not exist in the parent template",
    causes: [
      'The child template overrides block `{subject}`, but the parent template never defines it',
      'The block name `{subject}` may be misspelled in either the child or parent template',
      'The template may be extending the wrong parent file'
    ],
    fixCode: '{% extends "base.njk" %}\n{% block content %}...{% endblock %}',
    fixComment: 'Rename the child block to a block that exists in the parent, or add that block to the parent template'
  },
  {
    pattern: PATTERNS.NO_SUPER_BLOCK,
    category: 'no_super_block',
    subjectFrom: quotesExtractor,
    titleTemplate: "Cannot call super() - parent has no block",
    causes: [
      '`super()` called in block {subject} but parent has no block',
      'Using `super()` in a block with no **parent equivalent**',
      'Block override without a corresponding **parent block**'
    ],
    fixCode: '{% block {subject} %}...{% endblock %}',
    fixComment: 'Remove super() or use without super()'
  },
  {
    pattern: PATTERNS.CIRCULAR_INCLUDE,
    category: 'circular_include',
    subjectFrom: quotesExtractor,
    causes: [
      '**Template includes itself** (directly or indirectly)',
      '**Circular dependency** between templates'
    ],
    fixCode: '{% include "template.html" %}',
    fixComment: 'Remove circular include or use {% import %} for shared macros'
  },
  {
    pattern: PATTERNS.FILE_NOT_FOUND,
    category: 'file_not_found',
    subjectFrom: fileNotFoundExtractor,
    titleTemplate: "Template file not found: {subject}",
    causes: [
      'Template file `{subject}` **does not exist**',
      '**Incorrect path** in `include`/`extends`',
      'File **deleted or moved**'
    ],
    fixCode: '{% include "correct-path/{subject}" %}',
    fixComment: 'Verify template file path: {subject}'
  },
  {
    pattern: PATTERNS.IMPORT_ERROR,
    category: 'import_error',
    subjectFrom: importErrorExtractor,
    titleTemplate: "Cannot import template - module not found",
    causes: [
      '**Import failed** - template could not be loaded',
      'Module **not found** or path is incorrect',
      'Check **file path** in import statement'
    ],
    fixCode: '{% import "correct-path/template.njk" as mod %}',
    fixComment: 'Verify import path exists'
  },
  {
    pattern: PATTERNS.INVALID_INCLUDE,
    category: 'invalid_include',
    subjectFrom: null,
    titleTemplate: "Include path must be a string literal",
    causes: [
      '**Include path** is not a string literal',
      'Variable used in `include` must be a **string**'
    ],
    fixCode: '{% include "template.html" %}',
    fixComment: 'Use string literal for include path'
  },
  {
    pattern: PATTERNS.FILE_NOT_FOUND,
    category: 'filesystem_error',
    subjectFrom: null,
    titleTemplate: "Cannot access template file",
    causes: [
      'Template path points to a **directory** instead of a file',
      'File or directory **does not exist**',
      '**Permission denied** accessing file'
    ],
    fixCode: '{% include "template.html" %}',
    fixComment: 'Verify template path is a valid file'
  },
  {
    pattern: PATTERNS.SANDBOX_ACCESS,
    category: 'sandbox_blocked',
    subjectFrom: blockedKeyExtractor,
    titleTemplate: "Cannot access '{subject}' in sandbox mode",
    causes: [
      '**Sandbox mode** blocks access to `{subject}`',
      'Dangerous property access attempted in sandboxed template'
    ],
    fixCode: 'Remove access to blocked property or disable sandbox',
    fixComment: 'Remove access to {subject} in your template'
  },
  {
    pattern: PATTERNS.SANDBOX_SET,
    category: 'sandbox_blocked',
    subjectFrom: blockedKeyExtractor,
    titleTemplate: "Cannot set '{subject}' in sandbox mode",
    causes: [
      '**Sandbox mode** blocks setting `{subject}`',
      'Attempted to modify blocked property in sandboxed template'
    ],
    fixCode: 'Remove assignment to blocked property or disable sandbox',
    fixComment: 'Remove assignment to {subject} in your template'
  },
  {
    pattern: PATTERNS.SLICE_STEP,
    category: 'slice_error',
    subjectFrom: null,
    titleTemplate: 'Slice step cannot be zero',
    causes: [
      '**Slice step** cannot be zero (division by zero)',
      'Invalid slice notation: `[::0]` is not allowed'
    ],
    fixCode: '{{ list[::1] }}',
    fixComment: 'Slice step must be non-zero'
  },
  {
    pattern: PATTERNS.LIST_FILTER,
    category: 'iterable_error',
    subjectFrom: undefinedNameExtractor,
    titleTemplate: "List value '{subject}' is not iterable",
    causes: [
      '**List filter** requires an **iterable** input',
      'Passed value type is not iterable (e.g., number, null)'
    ],
    fixCode: '{{ "string" | list }}',
    fixComment: 'Use list filter with strings or arrays'
  },
  {
    pattern: PATTERNS.IN_OPERATOR,
    category: 'operator_error',
    subjectFrom: searchValueExtractor,
    causes: [
      '**In operator** only works with **objects**, not primitives',
      'Cannot search for value in **string/number/boolean**'
    ],
    fixCode: '{{ "key" in { key: "value" } }}',
    fixComment: 'In operator requires an object, not a primitive'
  },
  {
    pattern: PATTERNS.TIMEOUT,
    category: 'timeout_error',
    subjectFrom: null,
    causes: [
      'Template **took too long** to execute',
      'Infinite loop in template',
      'Large data processing in template'
    ],
    fixCode: 'Increase timeout or optimize template',
    fixComment: 'Set executionTimeout to a higher value or optimize template'
  },
  {
    pattern: PATTERNS.SANDBOX_CONTEXT_MODIFY,
    category: 'sandbox_blocked',
    subjectFrom: null,
    causes: [
      'Attempted to modify **sandboxed context**',
      'Setting globals or protected keys in sandbox mode'
    ],
    fixCode: 'Disable sandbox or use allowed keys',
    fixComment: 'Remove the set statement or disable sandbox mode'
  },
  {
    pattern: PATTERNS.BLOCKED_CONTEXT_KEYS,
    category: 'security_error',
    subjectFrom: null,
    causes: [
      'Context contains **blocked keys** like __proto__',
      'Dangerous keys detected in render context'
    ],
    fixCode: 'Remove blocked keys from context',
    fixComment: 'Clean the context before passing to render'
  },
  {
    pattern: PATTERNS.DANGEROUS_CONTEXT_VALUES,
    category: 'security_error',
    subjectFrom: null,
    causes: [
      'Context contains **dangerous values** like eval or Function',
      'Potentially malicious functions in context'
    ],
    fixCode: 'Remove dangerous functions from context',
    fixComment: 'Clean the context before passing to render'
  },
  {
    pattern: PATTERNS.DANGEROUS_TEMPLATE_CODE,
    category: 'security_error',
    subjectFrom: null,
    causes: [
      'Template contains **dangerous code patterns**',
      'Attempted to access global objects'
    ],
    fixCode: 'Remove dangerous code from template',
    fixComment: 'Do not use eval, Function, or access global in templates'
  },
  {
    pattern: PATTERNS.TEMPLATE_SIZE_EXCEEDED,
    category: 'validation_error',
    subjectFrom: null,
    causes: [
      'Template **exceeds maximum allowed size**',
      'Template is too large for processing'
    ],
    fixCode: 'Increase maxTemplateSize or split template',
    fixComment: 'Set maxTemplateSize to a higher value'
  },
  {
    pattern: PATTERNS.INVALID_CONFIG,
    category: 'validation_error',
    subjectFrom: null,
    causes: [
      'Invalid **configuration value**',
      'Negative timeout or size values are not allowed'
    ],
    fixCode: 'Set executionTimeout and maxTemplateSize to >= 0',
    fixComment: 'Use non-negative values for timeout and size'
  },
  {
    pattern: PATTERNS.TEMPLATE_MUST_BE_STRING,
    category: 'validation_error',
    subjectFrom: null,
    sourceFromStack: true,
    titleTemplate: "Template must be a string",
    causes: [
      'Template must be a **string**, got null/undefined',
      'Passed template is not a valid string'
    ],
    fixCode: 'Pass a valid template string',
    fixComment: 'Ensure template parameter is a string'
  },
  {
    pattern: PATTERNS.JS_STACK_SOURCE,
    category: 'js_stack_source',
    subjectFrom: null,
    sourceFromStack: true,
    titleTemplate: "Template parameter is null or invalid",
    causes: [
      '**Template parameter** is null or invalid',
      'Passed template is not a valid string'
    ],
    fixCode: 'Pass a valid template string',
    fixComment: 'Ensure template parameter is a string'
  },
  {
    pattern: PATTERNS.TEMPLATE_NULL,
    category: 'invalid_template',
    subjectFrom: null,
    titleTemplate: "Template is null or undefined",
    causes: [
      'Template is **null** or **undefined**',
      'Passed template parameter is not a valid string'
    ],
    fixCode: 'Pass a valid template string',
    fixComment: 'Ensure template is a non-null string'
  },
  {
    pattern: PATTERNS.GROUPBY_FILTER_ATTR,
    category: 'groupby_type_error',
    subjectFrom: null,
    causes: [
      'Groupby attribute **resolved to undefined**',
      'Property used in groupby does not exist'
    ],
    fixCode: 'Use an attribute that exists on the items',
    fixComment: 'Check that the attribute exists on all items'
  },
  {
    pattern: PATTERNS.DICTSDICT_FILTER,
    category: 'dictsort_value_error',
    subjectFrom: null,
    causes: [
      '**Dictsort filter** requires an **object** input',
      'Passed value is not an object'
    ],
    fixCode: '{{ data |> dictsort }}',
    fixComment: 'Use dictsort with an object'
  },
  {
    pattern: PATTERNS.DICTSDICT_FILTER_BY,
    category: 'dictsort_by_error',
    subjectFrom: null,
    causes: [
      '**Dictsort filter** `by` parameter must be "key" or "value"',
      'Invalid value passed to dictsort by parameter'
    ],
    fixCode: '{{ data |> dictsort(false, "key") }}',
    fixComment: 'Use "key" or "value" for the by parameter'
  },
  {
    pattern: PATTERNS.SORT_FILTER,
    category: 'sort_type_error',
    subjectFrom: undefinedNameExtractor,
    causes: [
      'Sort attribute **resolved to undefined**',
      'Property used in sort does not exist'
    ],
    fixCode: 'Use an attribute that exists on the items',
    fixComment: 'Check that the attribute exists on all items'
  },
  {
    pattern: PATTERNS.RESERVED_KEYWORD,
    category: 'reserved_keyword',
    subjectFrom: null,
    causes: [
      'Used a **reserved keyword** as filter or global name',
      'Cannot override built-in JavaScript or nunjucks keywords'
    ],
    fixCode: 'Use a different name for your filter or global',
    fixComment: 'Choose a name that is not a reserved keyword'
  },
  {
    pattern: PATTERNS.RESERVED_KEYWORD_CONTEXT,
    category: 'reserved_keyword_context',
    subjectFrom: undefinedNameExtractor,
    titleTemplate: "Cannot use reserved keyword '{subject}' outside of its intended context",
    causes: [
      '`{subject}` is a **reserved keyword** with special context requirements',
      'Only available in specific template constructs'
    ],
    fixCode: 'Use {subject} only in its intended context',
    fixComment: 'Review when {subject} can be used'
  },
  {
    pattern: PATTERNS.UNKNOWN_BLOCK_RUNTIME,
    category: 'undefined_block',
    subjectFrom: null,
    causes: [
      'A child template is overriding a block that the parent template does not define',
      'The block name may be misspelled, or the wrong parent template is being extended'
    ],
    fixCode: 'Rename the child block or add the missing block to the parent template',
    fixComment: 'Make sure the child and parent templates use the same block name'
  },
  {
    pattern: PATTERNS.NO_SUPER_BLOCK,
    category: 'no_super_block',
    subjectFrom: null,
    causes: [
      'Called **super()** on a block with no parent',
      'Block has no parent template to inherit from'
    ],
    fixCode: 'Remove super() call or extend a parent template',
    fixComment: 'Remove super() or ensure template extends a parent with the block'
  },
  {
    pattern: PATTERNS.PARSER_EXPECTED,
    category: 'syntax_error',
    subjectFrom: null,
    causes: [
      '**Parser expected** a different token',
      'Missing or misplaced token in template'
    ],
    fixCode: 'Check template syntax around the error line',
    fixComment: 'Review the template syntax at the error location'
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
    fixComment: 'Use correct for loop syntax: for item in items'
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
    fixComment: 'Use a valid variable name ( alphanumeric and underscore)'
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
    fixComment: 'Ensure tag has a valid name'
  },
  {
    pattern: PATTERNS.ASSERT_TYPE_ERROR,
    category: 'type_error',
    subjectFrom: null,
    causes: [
      '**Type assertion failed** in compiled code',
      'Internal nunjucks type mismatch'
    ],
    fixCode: 'This is likely a nunjucks internal error',
    fixComment: 'Report this as a bug if it occurs'
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
    fixComment: 'Use valid boolean values: true or false'
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
    fixComment: 'Add a valid expression'
  },
  {
    pattern: PATTERNS.CONTAINER_FACTORY,
    category: 'config_error',
    subjectFrom: undefinedNameExtractor,
    causes: [
      '**Container factory** must be a function',
      'Registered container factory is not callable'
    ],
    fixCode: 'container.register("name", () => new MyClass())',
    fixComment: 'Pass a function that returns an instance'
  },
  {
    pattern: PATTERNS.CONTAINER_NOT_REGISTERED,
    category: 'config_error',
    subjectFrom: undefinedNameExtractor,
    causes: [
      '**Container** not registered',
      'Requested container has not been registered'
    ],
    fixCode: 'container.register("name", () => new MyClass())',
    fixComment: 'Register the container before resolving'
  },
];

export interface Classification {
  category: string;
  undefinedName: string | null;
  causes: string[];
  fixCode: string | null;
  fixComment: string | null;
  title?: string | null;
}

export const DEFAULT_CLASSIFICATION: Classification = {
  category: 'unknown',
  undefinedName: null,
  causes: [
    'Check template **syntax**',
    'Verify **variable scope**',
    'Check **render context** data'
  ],
  fixCode: 'Inspect the error message above for clues',
  fixComment: 'Review the template source and context'
};
