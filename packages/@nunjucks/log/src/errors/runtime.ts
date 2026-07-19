import type { ErrorDefinition, SubjectExtractor, ExtraExtractor } from './types.ts';

const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

export const RUNTIME_ERRORS = {
  NULL_VALUE: {
    name: 'NULL_VALUE',
    message: "Cannot access '{accessPath}' on {state} '{parent}'",
    pattern: /^Cannot access '([^']+)' on (null|undefined) '([^']+)'$/i,
    category: 'null_value',
    titleTemplate: "Cannot access '{subject}'",
    causes: [
      'Parent object is **null** or **undefined**',
      'Check for proper **null checks** before access',
      'Use **optional chaining** `?.` to safely access'
    ],
    fixCode: "{{ {parent}?.{accessPath} }}",
    fixComment: 'Use optional chaining `?.` or add null check',
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
      'Variable `{subject}` not passed in `render` context',
      '**Typo** in variable name',
      'Using an **undefined variable** name'
    ],
    fixCode: "{{ '{subject}' |> default('default_value') }}",
    fixComment: 'Add default filter or pass {subject} in context',
    subjectFrom: firstCapture
  },
  UNDEFINED_PROPERTY: {
    name: 'UNDEFINED_PROPERTY',
    message: "Property '{property}' not found in '{parent}'",
    pattern: /^Property '([^']+)' not found in '([^']+)'$/i,
    category: 'undefined_property',
    titleTemplate: "Property '{subject}' not found",
    causes: [
      'Property `{property}` does not exist on `{parent}`',
      'Property name **typo**',
      'Parent object is **undefined** or **null**'
    ],
    fixCode: "{{ {parent}?.{property} |> default('default_value') }}",
    fixComment: 'Add optional chaining or provide a default value',
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
      'Function `{subject}` not registered with `env.addGlobal()`',
      'Filter `{subject}` not registered with `env.addFilter()`',
      '**Misspelled** function or filter name'
    ],
    fixCode: "env.addGlobal('{subject}', callback)",
    fixComment: "Register the missing function '{subject}'",
    subjectFrom: firstCapture
  },
  NOT_A_FUNCTION: {
    name: 'NOT_A_FUNCTION',
    message: "'{name}' is not a function",
    pattern: /^'([^']+)' is not a function$/i,
    category: 'sandbox_blocked',
    titleTemplate: "'{subject}' is not a function",
    causes: [
      '**Calling a non-function value**',
      'Variable contains wrong data type',
      'In sandbox mode, restricted operations may cause this error'
    ],
    fixCode: "Check variable type before calling\nconsole.log(typeof variable)",
    fixComment: 'Verify the variable type or disable sandbox',
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
      'The template may be extending the wrong parent file'
    ],
    fixCode: '{% extends "base.njk" %}\n{% block content %}...{% endblock %}',
    fixComment: 'Rename the child block to a block that exists in the parent, or add that block to the parent template',
    subjectFrom: firstCapture
  },
  UNDEFINED_FILTER: {
    name: 'UNDEFINED_FILTER',
    message: "Filter '{name}' is not defined",
    pattern: /^Filter '([^']+)' is not defined$/i,
    category: 'undefined_filter',
    titleTemplate: "Filter '{subject}' is not defined",
    causes: [
      'Filter `{subject}` not registered with `env.addFilter()`',
      '**Typo** in filter name',
      'Input value is **undefined** - check the variable being filtered exists'
    ],
    fixCode: "env.addFilter('{subject}', fn)",
    fixComment: "Register the missing filter '{subject}' or provide a default value",
    subjectFrom: firstCapture
  },
  UNDEFINED_TEST: {
    name: 'UNDEFINED_TEST',
    message: "Test '{name}' is not defined",
    pattern: /^Test '([^']+)' is not defined$/i,
    category: 'undefined_test',
    causes: [
      'Test `{subject}` not registered',
      '**Typo** in test name'
    ],
    fixCode: "env.addTest('{subject}', fn)",
    fixComment: "Register the missing test '{subject}'",
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
      'The template may be extending the wrong parent file'
    ],
    fixCode: '{% extends "base.njk" %}\n{% block content %}...{% endblock %}',
    fixComment: 'Rename the child block to a block that exists in the parent, or add that block to the parent template',
    subjectFrom: firstCapture
  },
  DUPLICATE_BLOCK: {
    name: 'DUPLICATE_BLOCK',
    message: 'Block "{name}" defined more than once',
    pattern: /^Block "([^"]+)" defined more than once$/i,
    category: 'duplicate_block',
    titleTemplate: "Block '{subject}' is defined more than once",
    causes: [
      '**Duplicate block** definition in template',
      'Block is defined multiple times'
    ],
    fixCode: "{% block content %}{% endblock %}",
    fixComment: 'Remove duplicate block definitions',
    subjectFrom: firstCapture
  },
  NO_SUPER_BLOCK: {
    name: 'NO_SUPER_BLOCK',
    message: 'No super block available',
    pattern: /no super block available|called super\(\) in a block without parent/i,
    category: 'no_super_block',
    titleTemplate: "Cannot call super() - parent has no block",
    causes: [
      '`super()` called in block {subject} but parent has no block',
      'Using `super()` in a block with no **parent equivalent**',
      'Block override without a corresponding **parent block**'
    ],
    fixCode: '{% block {subject} %}...{% endblock %}',
    fixComment: 'Remove super() or use without super()',
    subjectFrom: firstCapture
  },
  IN_OPERATOR: {
    name: 'IN_OPERATOR',
    message: "Cannot use 'in' operator to search for '{key}' in {type}",
    pattern: /^Cannot use 'in' operator to search for '([^']+)' in (.+)$/i,
    category: 'operator_error',
    titleTemplate: "Cannot use 'in' operator to search for '{subject}'",
    causes: [
      '**In operator** only works with **objects**, not primitives',
      'Cannot search for value in **string/number/boolean**'
    ],
    fixCode: '{{ "key" in { key: "value" } }}',
    fixComment: 'In operator requires an object, not a primitive',
    subjectFrom: (groups) => `${groups[1]} in ${groups[2]}`
  },
  TIMEOUT: {
    name: 'TIMEOUT',
    message: 'Template rendering timed out after {ms}ms',
    pattern: /^Template rendering timed out after (\d+)ms$/i,
    category: 'timeout_error',
    causes: [
      'Template **took too long** to execute',
      'Infinite loop in template',
      'Large data processing in template'
    ],
    fixCode: 'Increase timeout or optimize template',
    fixComment: 'Set executionTimeout to a higher value or optimize template',
    subjectFrom: null
  },
  KEY_NOT_FOUND: {
    name: 'KEY_NOT_FOUND',
    message: "Key '{key}' not found",
    pattern: /^Key '([^']+)' not found$/i,
    category: 'key_not_found',
    causes: [
      '**Key** not found in object'
    ],
    fixCode: 'Check that the key exists in the object',
    fixComment: 'Verify the key name is correct',
    subjectFrom: firstCapture
  },
  INVALID_LOOKUP: {
    name: 'INVALID_LOOKUP',
    message: 'expected name as lookup value after {marker} on {target}, got {value}',
    pattern: /expected name as lookup value after (dot|\?\.) on (.+), got (.+)$/i,
    category: 'invalid_lookup',
    titleTemplate: "Invalid property access: {subject}",
    causes: [
      'Invalid character `{subject}` after dot (e.g. `{target}.[{subject}]`)',
      'Use **either dot** (`{target}.key`) **or bracket** (`{target}["key"]`) **notation**',
      '**Mixed notation** is not allowed'
    ],
    fixCode: "{{ {target}.key }} or {{ {target}['key'] }}",
    fixComment: 'Use dot OR bracket notation, not both',
    subjectFrom: firstCapture
  },
  UNDEFINED_VALUE_MATCH: {
    name: 'UNDEFINED_VALUE_MATCH',
    message: 'Attempted to output undefined value',
    pattern: /attempted to output (?:null|undefined) value/i,
    category: 'undefined_value',
    titleTemplate: "Cannot read property '{subject}' of undefined",
    causes: [
      '**Nested property access** returned `null`/`undefined`',
      '**Array index** out of bounds',
      '**Object property** does not exist'
    ],
    fixCode: "{{ object.property |> default('default_value') }}",
    fixComment: 'Use default filter or safe navigation for nested properties',
    subjectFrom: firstCapture
  },
  CALL_MATCH: {
    name: 'CALL_MATCH',
    message: 'Unable to call',
    pattern: /Unable to call `([^`]+)`/,
    category: 'undefined_function',
    causes: [
      '**Unable to call** the function'
    ],
    fixCode: 'Ensure the function is defined',
    fixComment: 'Check that the function exists',
    subjectFrom: firstCapture
  },
  OUTPUT_MATCH: {
    name: 'OUTPUT_MATCH',
    message: 'Attempted to output',
    pattern: /attempted to output '([^']+)'/i,
    category: 'undefined_value',
    causes: [
      '**Attempted to output** an undefined value'
    ],
    fixCode: 'Ensure the value is defined',
    fixComment: 'Check that the value exists',
    subjectFrom: firstCapture
  },
  RESERVED_KEYWORD: {
    name: 'RESERVED_KEYWORD',
    message: "Cannot use reserved {type} '{name}'",
    pattern: /^Cannot use reserved (.+) '([^']+)'$/i,
    category: 'reserved_keyword',
    causes: [
      'Used a **reserved keyword** as filter or global name',
      'Cannot override built-in JavaScript or nunjucks keywords'
    ],
    fixCode: 'Use a different name for your filter or global',
    fixComment: 'Choose a name that is not a reserved keyword',
    subjectFrom: null
  },
  RESERVED_KEYWORD_CONTEXT: {
    name: 'RESERVED_KEYWORD_CONTEXT',
    message: "Cannot use reserved keyword '{name}' outside of its intended context",
    pattern: /reserved keyword.*context|cannot use.*reserved keyword|caller.*only available|only available inside.*call/i,
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
  ASSERT_TYPE_ERROR: {
    name: 'ASSERT_TYPE_ERROR',
    message: 'Invalid type assertion',
    pattern: /^assertType: invalid type: /i,
    category: 'type_error',
    causes: [
      '**Type assertion failed** in compiled code',
      'Internal nunjucks type mismatch'
    ],
    fixCode: 'This is likely a nunjucks internal error',
    fixComment: 'Report this as a bug if it occurs',
    subjectFrom: null
  }
} as const satisfies Record<string, ErrorDefinition>;

export type RuntimeErrorName = keyof typeof RUNTIME_ERRORS;
