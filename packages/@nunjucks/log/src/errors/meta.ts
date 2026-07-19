import type { ErrorDefinition, SubjectExtractor } from './types.ts';

const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

export const META_ERRORS = {
  LINE_INFO_MATCH: {
    name: 'LINE_INFO_MATCH',
    message: 'Line info',
    pattern: /\[Line (\d+)(?:, Column (\d+))?\]/i,
    category: 'line_info',
    causes: [],
    fixCode: '',
    fixComment: '',
    subjectFrom: null
  },
  COLUMN_INFO_MATCH: {
    name: 'COLUMN_INFO_MATCH',
    message: 'Column info',
    pattern: /Column (\d+)/i,
    category: 'column_info',
    causes: [],
    fixCode: '',
    fixComment: '',
    subjectFrom: null
  },
  INCLUDED_FROM_MATCH: {
    name: 'INCLUDED_FROM_MATCH',
    message: 'Included from',
    pattern: /\(included from ([^:)]+\.html)(?::\d+)?(?::\d+)?\)/,
    category: 'included_from',
    causes: [],
    fixCode: '',
    fixComment: '',
    subjectFrom: null
  },
  INCLUDED_FROM_WITH_LINE_MATCH: {
    name: 'INCLUDED_FROM_WITH_LINE_MATCH',
    message: 'Included from with line',
    pattern: /\(included from ([^:]+\.html):(\d+)(?::(\d+))?\)/,
    category: 'included_from',
    causes: [],
    fixCode: '',
    fixComment: '',
    subjectFrom: null
  }
} as const satisfies Record<string, ErrorDefinition>;

export type MetaErrorName = keyof typeof META_ERRORS;
