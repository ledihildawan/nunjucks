import type { ErrorDefinition, SubjectExtractor } from './types.ts';

const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

export const IO_ERRORS = {
  FILE_NOT_FOUND: {
    name: 'FILE_NOT_FOUND',
    message: 'template not found: {path}',
    pattern: /^template not found: (.+)$/i,
    category: 'file_not_found',
    titleTemplate: "Template file not found: {subject}",
    causes: [
      'Template file `{subject}` **does not exist**',
      '**Incorrect path** in `include`/`extends`',
      'File **deleted or moved**'
    ],
    fixCode: '{% include "correct-path/{subject}" %}',
    fixComment: 'Verify template file path: {subject}',
    subjectFrom: firstCapture
  },
  CIRCULAR_INCLUDE: {
    name: 'CIRCULAR_INCLUDE',
    message: 'Circular include detected',
    pattern: /^Circular include detected$/i,
    category: 'circular_include',
    titleTemplate: "Circular include detected",
    causes: [
      '**Template includes itself** (directly or indirectly)',
      '**Circular dependency** between templates'
    ],
    fixCode: '{% include "template.html" %}',
    fixComment: 'Remove circular include or use {% import %} for shared macros',
    subjectFrom: null
  },
  FILESYSTEM_ERROR: {
    name: 'FILESYSTEM_ERROR',
    message: 'Filesystem error: {msg}',
    pattern: /^Filesystem error: (.+)$/i,
    category: 'filesystem_error',
    titleTemplate: "Filesystem error: {subject}",
    causes: [
      'Template path points to a **directory** instead of a file',
      'File or directory **does not exist**',
      '**Permission denied** accessing file'
    ],
    fixCode: '{% include "template.html" %}',
    fixComment: 'Verify template path is a valid file',
    subjectFrom: firstCapture
  },
  INVALID_INCLUDE: {
    name: 'INVALID_INCLUDE',
    message: 'template names must be a string',
    pattern: /^template names must be a string$/i,
    category: 'invalid_include',
    titleTemplate: "Include path must be a string literal",
    causes: [
      '**Include path** is not a string literal',
      'Variable used in `include` must be a **string**'
    ],
    fixCode: '{% include "template.html" %}',
    fixComment: 'Use string literal for include path',
    subjectFrom: null
  },
  IMPORT_ERROR: {
    name: 'IMPORT_ERROR',
    message: "Cannot import '{name}' from module",
    pattern: /^Cannot import '([^']+)' from module$|^cannot find module.*\.njm/i,
    category: 'import_error',
    titleTemplate: "Cannot import template - module not found",
    causes: [
      '**Import failed** - template could not be loaded',
      'Module **not found** or path is incorrect',
      'Check **file path** in import statement'
    ],
    fixCode: '{% import "correct-path/template.njk" as mod %}',
    fixComment: 'Verify import path exists',
    subjectFrom: firstCapture
  }
} as const satisfies Record<string, ErrorDefinition>;

export type IoErrorName = keyof typeof IO_ERRORS;
