import type { ErrorDefinition, SubjectExtractor } from './types.ts';

const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

const DOCS_BASE = 'https://mozilla.github.io/nunjucks/templating.html';

export const FILTER_ERRORS = {
  FILTER_ERROR: {
    name: 'FILTER_ERROR',
    message: 'Filter failed',
    pattern: /^Error: Filter .+? threw|filter threw|Filter .+? failed/i,
    category: 'filter_error',
    titleTemplate: 'A filter threw an error',
    causes: [
      'The filter **threw an error** during execution',
      'Invalid input value passed to the filter (e.g. `null` when array expected)',
      'A custom filter has a bug or missing edge case'
    ],
    fixCode: 'env.addFilter("myFilter", function(value) {\n  if (value === null || value === undefined) return "";\n  return value.toUpperCase();\n})',
    fixComment: 'Add input validation in your custom filter and handle edge cases',
    suggestion: 'Wrap the filter call in a try/catch in your JavaScript filter implementation',
    subjectFrom: null
  },
  FILTER_TYPE_ERROR: {
    name: 'FILTER_TYPE_ERROR',
    message: 'Filter type error',
    pattern: /attribute "([^"]+)" resolved to undefined/i,
    category: 'filter_type_error',
    titleTemplate: "Filter attribute '{subject}' resolved to undefined",
    causes: [
      'The filter tried to access attribute `{subject}` but it was `undefined`',
      'Some items in the array do not have the requested attribute',
      'The attribute name is misspelled in the filter argument'
    ],
    fixCode: '{{ items |> groupby("existingAttr") }}',
    fixComment: 'Use an attribute name that exists on all items',
    suggestion: 'Print `{{ items[0] |> dump }}` to inspect the structure',
    subjectFrom: firstCapture
  },
  SLICE_STEP: {
    name: 'SLICE_STEP',
    message: 'slice: step cannot be zero',
    pattern: /^slice: step cannot be zero$/i,
    category: 'slice_error',
    titleTemplate: 'Slice step cannot be zero',
    causes: [
      'The slice **step** is zero, which would cause an infinite loop',
      'Invalid slice notation like `[::0]` was used',
      'A computed step value happened to be zero'
    ],
    fixCode: '{{ list[::1] }}\n{{ list[::2] }}\n{{ list[1::2] }}',
    fixComment: 'Use a non-zero step. Positive steps go forward, negative go backward',
    suggestion: 'Step must be a non-zero integer. Use 1 for "every element", -1 for "reverse"',
    subjectFrom: null
  },
  LIST_FILTER: {
    name: 'LIST_FILTER',
    message: "list: '{type}' is not iterable",
    pattern: /^list: '([^']+)' is not iterable$/i,
    category: 'iterable_error',
    titleTemplate: "List value '{subject}' is not iterable",
    causes: [
      'The `list` filter requires an **iterable** input (string, array, etc.)',
      'Passed value `{subject}` is a primitive like number, boolean, or null',
      'An object was passed instead of an array'
    ],
    fixCode: '{{ "hello" |> list }}  {# ["h", "e", "l", "l", "o"] #}\n{{ [1, 2] |> list }}  {# [1, 2] #}',
    fixComment: 'Convert the value to a string or array first using `string()` or `array()`',
    suggestion: 'Check the value type with `{{ value | type }}` before passing to list',
    subjectFrom: firstCapture
  },
  SORT_FILTER: {
    name: 'SORT_FILTER',
    message: 'sort: expected array, got {type}',
    pattern: /^sort: expected array, got (.+)$/i,
    category: 'sort_type_error',
    titleTemplate: "Sort input '{subject}' is not an array",
    causes: [
      'The `sort` filter requires an **array** input',
      'A string, object, or null value was passed',
      'Maybe the variable was destructured incorrectly'
    ],
    fixCode: '{{ items |> sort }}',
    fixComment: 'Ensure the value passed to `sort` is an array',
    suggestion: 'Use `{{ value | type }}` to verify, or convert with `array()`',
    subjectFrom: firstCapture
  },
  SORT_FILTER_ATTR: {
    name: 'SORT_FILTER_ATTR',
    message: "sort: attribute '{attr}' does not exist on object",
    pattern: /^sort: attribute '([^']+)' does not exist on object$/i,
    category: 'sort_attr_error',
    titleTemplate: "Sort attribute '{subject}' does not exist",
    causes: [
      'The attribute `{subject}` is **missing on one or more items**',
      'The attribute name is misspelled in the sort call',
      'Inconsistent data shape across the array'
    ],
    fixCode: '{{ items |> sort(false, false, "existingAttr") }}',
    fixComment: 'Use an attribute that exists on every item in the array',
    suggestion: 'Print items first: `{% for i in items %}{{ i | dump }}{% endfor %}` to see available fields',
    subjectFrom: firstCapture
  },
  GROUPBY_FILTER: {
    name: 'GROUPBY_FILTER',
    message: 'groupby: expected array, got {type}',
    pattern: /^groupby: expected array, got (.+)$/i,
    category: 'groupby_type_error',
    titleTemplate: "Groupby input '{subject}' is not an array",
    causes: [
      'The `groupby` filter requires an **array** input',
      'The value `{subject}` is a string, object, or null',
      'A database query returned no results (empty array is OK, but undefined is not)'
    ],
    fixCode: '{{ items |> groupby("category") }}',
    fixComment: 'Pass an array to the groupby filter',
    suggestion: 'Check the query result and ensure you have an array, even if empty',
    subjectFrom: firstCapture
  },
  GROUPBY_FILTER_ATTR: {
    name: 'GROUPBY_FILTER_ATTR',
    message: "groupby: attribute '{attr}' does not exist on object",
    pattern: /^groupby: attribute '([^']+)' does not exist on object$/i,
    category: 'groupby_type_error',
    titleTemplate: "Groupby attribute '{subject}' does not exist",
    causes: [
      'The groupby attribute `{subject}` **does not exist on the items**',
      'The attribute name is misspelled',
      'Some items in the array have a different shape'
    ],
    fixCode: '{% for group in items |> groupby("category") %}\n  {{ group.grouper }}: {{ group.list | length }}\n{% endfor %}',
    fixComment: 'Use an attribute that exists on all items',
    suggestion: 'Inspect items with `dump` to find the correct attribute name',
    subjectFrom: firstCapture
  },
  DICTSDICT_FILTER: {
    name: 'DICTSDICT_FILTER',
    message: 'dictsort: expected object, got {type}',
    pattern: /^dictsort: expected object, got (.+)$/i,
    category: 'dictsort_value_error',
    titleTemplate: "Dictsort input '{subject}' is not an object",
    causes: [
      'The `dictsort` filter requires an **object** input',
      'An array or primitive was passed',
      'A nested object was expected but the path is wrong'
    ],
    fixCode: '{{ { b: 2, a: 1, c: 3 } |> dictsort }}',
    fixComment: 'Pass an object to dictsort, not an array',
    suggestion: 'Use `items | dictsort` for an array of objects or `myObj | dictsort` for a flat object',
    subjectFrom: firstCapture
  },
  DICTSDICT_FILTER_BY: {
    name: 'DICTSDICT_FILTER_BY',
    message: "dictsort: invalid sort mode '{by}'. Must be 'key' or 'value'",
    pattern: /^dictsort: invalid sort mode '([^']+)'\. Must be 'key' or 'value'$/i,
    category: 'dictsort_by_error',
    titleTemplate: "Dictsort sort mode '{subject}' is invalid",
    causes: [
      'The `dictsort` `by` parameter must be the literal string `"key"` or `"value"`',
      'A typo in the mode name (e.g. `keys` instead of `key`)',
      'A variable was passed without quotes around it'
    ],
    fixCode: '{{ data |> dictsort(false, "key") }}  {# sort by keys #}\n{{ data |> dictsort(false, "value") }}  {# sort by values #}',
    fixComment: 'Use exactly `"key"` or `"value"` (with quotes) as the by parameter',
    suggestion: 'The by parameter is case-sensitive: `"key"` not `"Key"`',
    subjectFrom: firstCapture
  }
} as const satisfies Record<string, ErrorDefinition>;

export type FilterErrorName = keyof typeof FILTER_ERRORS;
