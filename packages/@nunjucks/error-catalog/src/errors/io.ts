import { createErrorDefinition } from './factory.ts';

const DOCS_BASE = 'https://mozilla.github.io/nunjucks/templating.html';

export const IO_ERRORS = {
  FILE_NOT_FOUND: createErrorDefinition({
    name: 'FILE_NOT_FOUND',
    message: 'template not found: {path}',
    category: 'file_not_found',
    causes: [
      'The template file `{path}` **does not exist** at the given path',
      'The path used in `{% include %}` or `{% extends %}` is **incorrect**',
      'The file was **deleted, moved, or renamed** since the template was written',
      'The configured loader cannot resolve the path (check loaders config)'
    ],
    fixCode: '{% include "views/{path}" %}',
    fixComment: 'Verify the file path and ensure it is in one of the configured search paths',
    documentationUrl: `${DOCS_BASE}#includes`
  }),
  CIRCULAR_INCLUDE: createErrorDefinition({
    name: 'CIRCULAR_INCLUDE',
    message: 'Circular include detected',
    category: 'circular_include',
    causes: [
      'Template **includes itself** directly or through a chain of includes',
      'Two or more templates include each other in a loop',
      'A template is being included from its own descendant'
    ],
    fixCode: '{% include "shared/header.html" %}',
    fixComment: 'Break the cycle by extracting shared content into a third template',
    documentationUrl: `${DOCS_BASE}#includes`
  }),
  FILESYSTEM_ERROR: createErrorDefinition({
    name: 'FILESYSTEM_ERROR',
    message: 'Filesystem error: {msg}',
    category: 'filesystem_error',
    causes: [
      'The template path points to a **directory** instead of a file',
      'The file or directory **does not exist**',
      '**Permission denied** when accessing the file',
      'Disk I/O error or filesystem corruption'
    ],
    fixCode: '{% include "templates/header.html" %}',
    fixComment: 'Verify the template path points to a readable file'
  }),
  INVALID_INCLUDE: createErrorDefinition({
    name: 'INVALID_INCLUDE',
    message: 'template names must be a string',
    category: 'invalid_include',
    causes: [
      'The include path is **not a string literal** (it is a number, object, or expression)',
      'A variable used in `{% include %}` evaluates to a non-string value',
      'Missing quotes around the template name'
    ],
    fixCode: '{% include "template.html" %}',
    fixComment: 'Wrap the template name in quotes, or ensure the variable holds a string'
  }),
  IMPORT_ERROR: {
    name: 'IMPORT_ERROR',
    message: "Cannot import '{name}' from module",
    pattern: /^Cannot import '([^']+)' from module$|^cannot find module.*\.njm/iu,
    category: 'import_error',
    titleTemplate: "Cannot import template - module not found",
    causes: [
      'The **import failed** because the template could not be loaded',
      'The module **was not found** at the given path',
      'The **file path** in the `{% import %}` statement is incorrect',
      'The loader is not configured to find this type of file'
    ],
    fixCode: '{% import "macros/{name}.njk" as macros %}',
    fixComment: 'Verify the import path exists and the loader can find it'
  }
} as const;

export type IoErrorName = keyof typeof IO_ERRORS;
