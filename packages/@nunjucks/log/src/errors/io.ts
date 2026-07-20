import type { ErrorDefinition, SubjectExtractor } from './types.ts';

const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

const DOCS_BASE = 'https://mozilla.github.io/nunjucks/templating.html';

export const IO_ERRORS = {
  FILE_NOT_FOUND: {
    name: 'FILE_NOT_FOUND',
    message: 'template not found: {path}',
    pattern: /^template not found: (.+)$/i,
    category: 'file_not_found',
    titleTemplate: "Template file not found: {subject}",
    causes: [
      'The template file `{subject}` **does not exist** at the given path',
      'The path used in `{% include %}` or `{% extends %}` is **incorrect**',
      'The file was **deleted, moved, or renamed** since the template was written',
      'The configured loader cannot resolve the path (check loaders config)'
    ],
    fixCode: '{% include "views/{subject}" %}',
    fixComment: 'Verify the file path and ensure it is in one of the configured search paths',
    documentationUrl: `${DOCS_BASE}#includes`,
    subjectFrom: firstCapture
  },
  CIRCULAR_INCLUDE: {
    name: 'CIRCULAR_INCLUDE',
    message: 'Circular include detected',
    pattern: /^Circular include detected$/i,
    category: 'circular_include',
    titleTemplate: "Circular include detected",
    causes: [
      'Template **includes itself** directly or through a chain of includes',
      'Two or more templates include each other in a loop',
      'A template is being included from its own descendant'
    ],
    fixCode: '{% include "shared/header.html" %}',
    fixComment: 'Break the cycle by extracting shared content into a third template',
    documentationUrl: `${DOCS_BASE}#includes`,
    subjectFrom: null
  },
  FILESYSTEM_ERROR: {
    name: 'FILESYSTEM_ERROR',
    message: 'Filesystem error: {msg}',
    pattern: /^Filesystem error: (.+)$/i,
    category: 'filesystem_error',
    titleTemplate: "Filesystem error: {subject}",
    causes: [
      'The template path points to a **directory** instead of a file',
      'The file or directory **does not exist**',
      '**Permission denied** when accessing the file',
      'Disk I/O error or filesystem corruption'
    ],
    fixCode: '{% include "templates/header.html" %}',
    fixComment: 'Verify the template path points to a readable file',
    subjectFrom: firstCapture
  },
  INVALID_INCLUDE: {
    name: 'INVALID_INCLUDE',
    message: 'template names must be a string',
    pattern: /^template names must be a string$/i,
    category: 'invalid_include',
    titleTemplate: "Include path must be a string literal",
    causes: [
      'The include path is **not a string literal** (it is a number, object, or expression)',
      'A variable used in `{% include %}` evaluates to a non-string value',
      'Missing quotes around the template name'
    ],
    fixCode: '{% include "template.html" %}\n{% set name = "header.html" %}\n{% include name %}',
    fixComment: 'Wrap the template name in quotes, or ensure the variable holds a string',
    subjectFrom: null
  },
  IMPORT_ERROR: {
    name: 'IMPORT_ERROR',
    message: "Cannot import '{name}' from module",
    pattern: /^Cannot import '([^']+)' from module$|^cannot find module.*\.njm/i,
    category: 'import_error',
    titleTemplate: "Cannot import template - module not found",
    causes: [
      'The **import failed** because the template could not be loaded',
      'The module **was not found** at the given path',
      'The **file path** in the `{% import %}` statement is incorrect',
      'The loader is not configured to find this type of file'
    ],
    fixCode: '{% import "macros/{name}.njk" as macros %}',
    fixComment: 'Verify the import path exists and the loader can find it',
    subjectFrom: firstCapture
  }
} as const satisfies Record<string, ErrorDefinition>;

export type IoErrorName = keyof typeof IO_ERRORS;
