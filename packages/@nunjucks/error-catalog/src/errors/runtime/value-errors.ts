import { createErrorDefinition } from '../factory.ts';
import { firstCapture } from '../types.ts';

const NULL_VALUE = {
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
  extraFrom: (groups: RegExpMatchArray) => ({ accessPath: groups[1] ?? '', state: groups[2] ?? '', parent: groups[3] ?? '' })
};

const UNDEFINED_VARIABLE = createErrorDefinition({
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
  documentationUrl: 'https://mozilla.github.io/nunjucks/templating.html#variables'
});

const UNDEFINED_PROPERTY = {
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
  fixCode: '{{ product?.name |> default("N/A") }}',
  fixComment: 'Use optional chaining `?.` or `default()` to handle missing properties gracefully',
  extraFrom: (groups: RegExpMatchArray) => ({ property: groups[1] ?? '', parent: groups[2] ?? '' })
};

const UNDEFINED_VALUE_MATCH = createErrorDefinition({
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
});

const OUTPUT_MATCH = createErrorDefinition({
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
});

const CALL_MATCH = createErrorDefinition({
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
});

const IN_OPERATOR = {
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
};

const INVALID_LOOKUP = {
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
};

const KEY_NOT_FOUND = createErrorDefinition({
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
});

const NOT_A_FUNCTION = createErrorDefinition({
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
});

export {
  NULL_VALUE, UNDEFINED_VARIABLE, UNDEFINED_PROPERTY,
  UNDEFINED_VALUE_MATCH, OUTPUT_MATCH, CALL_MATCH,
  IN_OPERATOR, INVALID_LOOKUP, KEY_NOT_FOUND, NOT_A_FUNCTION,
};
