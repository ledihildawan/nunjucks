import { type ErrorDefinition, firstCapture } from './types.ts';

const DOCS_BASE = 'https://mozilla.github.io/nunjucks/api.html';

export const TEMPLATE_ERRORS = {
  VALIDATION_ERROR: {
    name: 'VALIDATION_ERROR',
    message: "Invalid value for '{key}'",
    pattern: /^Invalid value for '([^']+)'$/iu,
    category: 'validation_error',
    titleTemplate: "Invalid value for '{subject}'",
    causes: [
      'The value provided for `{subject}` is **not in the expected format**',
      'A required field is missing or empty',
      'A type mismatch (e.g. string expected, number given)'
    ],
    fixCode: 'env.opts.{subject} = "valid-value";',
    fixComment: 'Provide a valid value for the `{subject}` option',
    subjectFrom: firstCapture
  },
  TEMPLATE_INVALID_SOURCE: {
    name: 'TEMPLATE_INVALID_SOURCE',
    message: "Invalid template source: expected 'code' or 'string', got '{type}'",
    pattern: /src must be a string or an object describing the source/iu,
    category: 'invalid_template',
    titleTemplate: 'Invalid template source',
    causes: [
      'The template source is **not a string and not an object**',
      'A `null`, `undefined`, number, or boolean was passed instead',
      'The template loader returned an unexpected value'
    ],
    fixCode: 'render("Hello {{ name }}", { name: "World" })\n// or\nrender({ src: "template.njk", path: "/path" }, ctx)',
    fixComment: 'Pass a template string or a source descriptor object',
    subjectFrom: null
  },
  TEMPLATE_SRC_STRING: {
    name: 'TEMPLATE_SRC_STRING',
    message: 'Template src must be a string or an object',
    pattern: /^Template src must be a string or an object$/iu,
    category: 'invalid_template',
    titleTemplate: 'Template src must be string or object',
    causes: [
      'The `src` field of a template descriptor must be a **string** or **object**',
      'A primitive value like number, boolean, or null was given',
      'The template was loaded from an unsupported source'
    ],
    fixCode: 'render({ src: "template.njk", path: "/templates/template.njk" }, context)',
    fixComment: 'Provide src as a string path or a `{ src, path }` object',
    subjectFrom: null
  },
  TEMPLATE_NO_RENDER: {
    name: 'TEMPLATE_NO_RENDER',
    message: 'Template object is invalid: missing render method',
    pattern: /Unexpected template object type/iu,
    category: 'invalid_template',
    titleTemplate: 'Invalid template object',
    causes: [
      'The template object is **missing the `render` method**',
      'A custom template implementation does not conform to the template interface',
      'The template object was corrupted during processing'
    ],
    fixCode: 'render("Hello {{ name }}", { name: "World" })',
    fixComment: 'Pass a string template or a proper Template object',
    subjectFrom: null
  },
  INVALID_CODE_FORMAT: {
    name: 'INVALID_CODE_FORMAT',
    message: 'Invalid template: expected compiled template to start with "async function root"',
    pattern: /Unrecognized code format/iu,
    category: 'invalid_template',
    titleTemplate: 'Invalid compiled template format',
    causes: [
      'The compiled template code **does not start with the expected format**',
      'A custom compiler produced non-standard output',
      'The template was not compiled by nunjucks'
    ],
    fixCode: 'render("Hello {{ name }}", { name: "World" })',
    fixComment: 'Ensure the template is compiled by nunjucks using `compile()`',
    documentationUrl: `${DOCS_BASE}#compile`,
    subjectFrom: null
  },
  WALK_UNKNOWN_TYPE: {
    name: 'WALK_UNKNOWN_TYPE',
    message: "walk: unknown node type '{type}'",
    pattern: /walk: unknown (?:node type|typename)/iu,
    category: 'internal_error',
    titleTemplate: 'Unknown AST node type',
    causes: [
      'The AST transformer encountered a **node type it does not recognize**',
      'A custom extension produced an unexpected AST node',
      'Internal nunjucks bug'
    ],
    fixCode: '/* Please report this as a bug at https://github.com/mozilla/nunjucks/issues */',
    fixComment: 'This is a nunjucks internal error',
    documentationUrl: 'https://github.com/mozilla/nunjucks/issues',
    subjectFrom: null
  },
  TEMPLATE_SIZE_EXCEEDED: {
    name: 'TEMPLATE_SIZE_EXCEEDED',
    message: 'Template exceeds maximum size of {max} bytes',
    pattern: /Template exceeds maximum size/iu,
    category: 'validation_error',
    titleTemplate: 'Template size limit exceeded',
    causes: [
      'The template is **larger than the configured `maxTemplateSize`**',
      'A single template is too large for safe processing',
      'The size limit is too restrictive for your use case'
    ],
    fixCode: 'env.opts.maxTemplateSize = 1024 * 1024;  // 1 MB',
    fixComment: 'Increase `maxTemplateSize` or split the template into smaller files',
    subjectFrom: null
  },
  INVALID_CONFIG: {
    name: 'INVALID_CONFIG',
    message: 'Invalid configuration: {key} must be >= 0',
    pattern: /^Invalid configuration: (.+) must be >= 0$/iu,
    category: 'validation_error',
    titleTemplate: "Invalid configuration value for '{subject}'",
    causes: [
      'The configuration value `{subject}` is **negative** but must be `>= 0`',
      'Timeout or size values cannot be negative',
      'A unit mismatch (e.g. milliseconds vs seconds)'
    ],
    fixCode: 'env.opts.executionTimeout = 30000;  // 30 seconds\nenv.opts.maxTemplateSize = 1024 * 1024;',
    fixComment: 'Use non-negative values for `{subject}` (0 means unlimited)',
    subjectFrom: firstCapture
  },
  TEMPLATE_MUST_BE_STRING: {
    name: 'TEMPLATE_MUST_BE_STRING',
    message: 'Template must be a string',
    pattern: /^Template must be a string$/iu,
    category: 'validation_error',
    titleTemplate: 'Template must be a string',
    causes: [
      'The template parameter is **not a string** (got `null`, `undefined`, object, etc.)',
      'A file path was passed without a loader',
      'The render function received the wrong argument'
    ],
    fixCode: 'render("Hello {{ name }}", { name: "World" })\nrender("./template.njk", context, { loader: createFileSystemLoader(".") })',
    fixComment: 'Pass a string template or configure a loader for file paths',
    subjectFrom: null
  }
} as const satisfies Record<string, ErrorDefinition>;

export type TemplateErrorName = keyof typeof TEMPLATE_ERRORS;
