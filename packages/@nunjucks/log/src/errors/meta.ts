import type { ErrorDefinition, SubjectExtractor } from './types.ts';

const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

export const META_ERRORS = {
  LINE_INFO_MATCH: {
    name: 'LINE_INFO_MATCH',
    message: 'Line info',
    pattern: /\[Line (\d+)(?:, Column (\d+))?\]/i,
    category: 'line_info',
    causes: [
      'Internal regex for extracting line info from error messages',
      'Used by the classifier to parse `[Line X, Column Y]` annotations'
    ],
    fixCode: '/* Internal regex helper - not a user-facing error */',
    fixComment: 'This is an internal helper used by the classification system',
    subjectFrom: null
  },
  COLUMN_INFO_MATCH: {
    name: 'COLUMN_INFO_MATCH',
    message: 'Column info',
    pattern: /Column (\d+)/i,
    category: 'column_info',
    causes: [
      'Internal regex for extracting column info from error messages',
      'Used by the classifier to parse `Column N` annotations'
    ],
    fixCode: '/* Internal regex helper - not a user-facing error */',
    fixComment: 'This is an internal helper used by the classification system',
    subjectFrom: null
  },
  INCLUDED_FROM_MATCH: {
    name: 'INCLUDED_FROM_MATCH',
    message: 'Included from',
    pattern: /\(included from ([^:)]+\.html)(?::\d+)?(?::\d+)?\)/,
    category: 'included_from',
    causes: [
      'Internal regex for extracting the include chain from error messages',
      'Used by the classifier to show the template inclusion chain'
    ],
    fixCode: '/* Internal regex helper - not a user-facing error */',
    fixComment: 'This is an internal helper used by the classification system',
    subjectFrom: null
  },
  INCLUDED_FROM_WITH_LINE_MATCH: {
    name: 'INCLUDED_FROM_WITH_LINE_MATCH',
    message: 'Included from with line',
    pattern: /\(included from ([^:]+\.html):(\d+)(?::(\d+))?\)/,
    category: 'included_from',
    causes: [
      'Internal regex for extracting the include chain with line info',
      'Used by the classifier to show where the template was included from'
    ],
    fixCode: '/* Internal regex helper - not a user-facing error */',
    fixComment: 'This is an internal helper used by the classification system',
    subjectFrom: null
  }
} as const satisfies Record<string, ErrorDefinition>;

export type MetaErrorName = keyof typeof META_ERRORS;
