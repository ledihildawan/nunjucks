import type { ErrorDefinition, SubjectExtractor } from './types.ts';

const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

export const FILTER_ERRORS = {
  FILTER_ERROR: {
    name: 'FILTER_ERROR',
    message: 'Filter failed',
    pattern: /^Error: Filter .+? threw|filter threw|Filter .+? failed/i,
    category: 'filter_error',
    causes: [
      '**Filter threw an error** during execution'
    ],
    fixCode: "function myFilter(value) {\n  if (value === null || value === undefined) return '';\n}",
    fixComment: 'Check filter input validation and handle errors',
    subjectFrom: null
  },
  FILTER_TYPE_ERROR: {
    name: 'FILTER_TYPE_ERROR',
    message: 'Filter type error',
    pattern: /attribute "([^"]+)" resolved to undefined/i,
    category: 'filter_type_error',
    causes: [
      'Filter attribute **resolved to undefined**'
    ],
    fixCode: 'Ensure the attribute exists on the object',
    fixComment: 'Check that the attribute is defined',
    subjectFrom: firstCapture
  },
  SLICE_STEP: {
    name: 'SLICE_STEP',
    message: 'slice: step cannot be zero',
    pattern: /^slice: step cannot be zero$/i,
    category: 'slice_error',
    titleTemplate: 'Slice step cannot be zero',
    causes: [
      '**Slice step** cannot be zero (division by zero)',
      'Invalid slice notation: `[::0]` is not allowed'
    ],
    fixCode: '{{ list[::1] }}',
    fixComment: 'Slice step must be non-zero',
    subjectFrom: null
  },
  LIST_FILTER: {
    name: 'LIST_FILTER',
    message: "list: '{type}' is not iterable",
    pattern: /^list: '([^']+)' is not iterable$/i,
    category: 'iterable_error',
    titleTemplate: "List value '{subject}' is not iterable",
    causes: [
      '**List filter** requires an **iterable** input',
      'Passed value type is not iterable (e.g., number, null)'
    ],
    fixCode: '{{ "string" | list }}',
    fixComment: 'Use list filter with strings or arrays',
    subjectFrom: firstCapture
  },
  SORT_FILTER: {
    name: 'SORT_FILTER',
    message: 'sort: expected array, got {type}',
    pattern: /^sort: expected array, got (.+)$/i,
    category: 'sort_type_error',
    titleTemplate: "Sort input '{subject}' is not an array",
    causes: [
      'Sort attribute **resolved to undefined**',
      'Property used in sort does not exist'
    ],
    fixCode: 'Use an attribute that exists on the items',
    fixComment: 'Check that the attribute exists on all items',
    subjectFrom: firstCapture
  },
  SORT_FILTER_ATTR: {
    name: 'SORT_FILTER_ATTR',
    message: "sort: attribute '{attr}' does not exist on object",
    pattern: /^sort: attribute '([^']+)' does not exist on object$/i,
    category: 'sort_attr_error',
    titleTemplate: "Sort attribute '{subject}' does not exist",
    causes: [
      '**Sort attribute** resolved to `undefined`',
      'The property `{subject}` is missing on one or more items'
    ],
    fixCode: '{{ items |> sort(false, false, "existingAttr") }}',
    fixComment: "Ensure all items have the attribute '{subject}'",
    subjectFrom: firstCapture
  },
  GROUPBY_FILTER: {
    name: 'GROUPBY_FILTER',
    message: 'groupby: expected array, got {type}',
    pattern: /^groupby: expected array, got (.+)$/i,
    category: 'groupby_type_error',
    titleTemplate: "Groupby input '{subject}' is not an array",
    causes: [
      '**Groupby filter** requires an **array** input',
      'Passed value type `{subject}` is not iterable'
    ],
    fixCode: '{{ items |> groupby("category") }}',
    fixComment: 'Pass an array to groupby filter',
    subjectFrom: firstCapture
  },
  GROUPBY_FILTER_ATTR: {
    name: 'GROUPBY_FILTER_ATTR',
    message: "groupby: attribute '{attr}' does not exist on object",
    pattern: /^groupby: attribute '([^']+)' does not exist on object$/i,
    category: 'groupby_type_error',
    titleTemplate: "Groupby attribute '{subject}' does not exist",
    causes: [
      'Groupby attribute **resolved to undefined**',
      'Property used in groupby does not exist'
    ],
    fixCode: 'Use an attribute that exists on the items',
    fixComment: 'Check that the attribute exists on all items',
    subjectFrom: firstCapture
  },
  DICTSDICT_FILTER: {
    name: 'DICTSDICT_FILTER',
    message: 'dictsort: expected object, got {type}',
    pattern: /^dictsort: expected object, got (.+)$/i,
    category: 'dictsort_value_error',
    titleTemplate: "Dictsort input '{subject}' is not an object",
    causes: [
      '**Dictsort filter** requires an **object** input',
      'Passed value is not an object'
    ],
    fixCode: '{{ data |> dictsort }}',
    fixComment: 'Use dictsort with an object',
    subjectFrom: firstCapture
  },
  DICTSDICT_FILTER_BY: {
    name: 'DICTSDICT_FILTER_BY',
    message: "dictsort: invalid sort mode '{by}'. Must be 'key' or 'value'",
    pattern: /^dictsort: invalid sort mode '([^']+)'\. Must be 'key' or 'value'$/i,
    category: 'dictsort_by_error',
    titleTemplate: "Dictsort sort mode '{subject}' is invalid",
    causes: [
      '**Dictsort filter** `by` parameter must be "key" or "value"',
      'Invalid value passed to dictsort by parameter'
    ],
    fixCode: '{{ data |> dictsort(false, "key") }}',
    fixComment: 'Use "key" or "value" for the by parameter',
    subjectFrom: firstCapture
  }
} as const satisfies Record<string, ErrorDefinition>;

export type FilterErrorName = keyof typeof FILTER_ERRORS;
