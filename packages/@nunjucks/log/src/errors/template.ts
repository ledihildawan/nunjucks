import type { ErrorDefinition, SubjectExtractor } from './types.ts';

const firstCapture: SubjectExtractor = (groups) => groups[1] ?? null;

export const TEMPLATE_ERRORS = {
  VALIDATION_ERROR: {
    name: 'VALIDATION_ERROR',
    message: "Invalid value for '{key}'",
    pattern: /^Invalid value for '([^']+)'$/i,
    category: 'validation_error',
    causes: [
      '**Invalid value** for configuration'
    ],
    fixCode: 'Check the value and try again',
    fixComment: 'Verify the value is valid',
    subjectFrom: firstCapture
  },
  CONTAINER_FACTORY: {
    name: 'CONTAINER_FACTORY',
    message: "Container: factory for '{name}' must be a function, got {type}",
    pattern: /^Container: factory for '([^']+)' must be a function, got (.+)$/i,
    category: 'config_error',
    titleTemplate: "Container factory '{subject}' is not a function",
    causes: [
      '**Container factory** must be a function',
      'Registered container factory is not callable'
    ],
    fixCode: 'container.register("name", () => new MyClass())',
    fixComment: 'Pass a function that returns an instance',
    subjectFrom: firstCapture
  },
  CONTAINER_NOT_REGISTERED: {
    name: 'CONTAINER_NOT_REGISTERED',
    message: "Container: '{name}' is not registered. Did you forget to register it?",
    pattern: /^Container: '([^']+)' is not registered\. Did you forget to register it\?$/i,
    category: 'config_error',
    titleTemplate: "Container '{subject}' is not registered",
    causes: [
      '**Container** not registered',
      'Requested container has not been registered'
    ],
    fixCode: 'container.register("name", () => new MyClass())',
    fixComment: 'Register the container before resolving',
    subjectFrom: firstCapture
  },
  CONTAINER_ERROR: {
    name: 'CONTAINER_ERROR',
    message: 'Container error',
    pattern: /Container: (?:factory for '([^']+)'|'([^']+)' is not registered)/i,
    category: 'config_error',
    causes: [
      '**Container** error occurred'
    ],
    fixCode: 'Check container registration',
    fixComment: 'Verify container is properly registered',
    subjectFrom: null
  },
  TEMPLATE_INVALID_SOURCE: {
    name: 'TEMPLATE_INVALID_SOURCE',
    message: "Invalid template source: expected 'code' or 'string', got '{type}'",
    pattern: /src must be a string or an object describing the source/i,
    category: 'invalid_template',
    causes: [
      'Template source is **invalid**'
    ],
    fixCode: 'Pass a valid template string or object',
    fixComment: 'Ensure template source is valid',
    subjectFrom: null
  },
  TEMPLATE_SRC_STRING: {
    name: 'TEMPLATE_SRC_STRING',
    message: 'Template src must be a string or an object',
    pattern: /^Template src must be a string or an object$/i,
    category: 'invalid_template',
    causes: [
      'Template source must be a **string or object**'
    ],
    fixCode: 'Pass a valid template string or object',
    fixComment: 'Ensure template source is valid',
    subjectFrom: null
  },
  TEMPLATE_NO_RENDER: {
    name: 'TEMPLATE_NO_RENDER',
    message: 'Template object is invalid: missing render method',
    pattern: /Unexpected template object type/i,
    category: 'invalid_template',
    causes: [
      'Template object is **invalid** - missing render method'
    ],
    fixCode: 'Pass a valid template object',
    fixComment: 'Ensure template has a render method',
    subjectFrom: null
  },
  INVALID_CODE_FORMAT: {
    name: 'INVALID_CODE_FORMAT',
    message: 'Invalid template: expected compiled template to start with "async function root"',
    pattern: /Unrecognized code format/i,
    category: 'invalid_template',
    causes: [
      'Template code format is **invalid**'
    ],
    fixCode: 'Ensure template is properly compiled',
    fixComment: 'Check template compilation',
    subjectFrom: null
  },
  WALK_UNKNOWN_TYPE: {
    name: 'WALK_UNKNOWN_TYPE',
    message: "walk: unknown node type '{type}'",
    pattern: /walk: unknown (?:node type|typename)/i,
    category: 'internal_error',
    causes: [
      '**Internal error** - unknown node type'
    ],
    fixCode: 'This is a nunjucks internal error',
    fixComment: 'Report this as a bug',
    subjectFrom: null
  },
  TEMPLATE_SIZE_EXCEEDED: {
    name: 'TEMPLATE_SIZE_EXCEEDED',
    message: 'Template exceeds maximum size of {max} bytes',
    pattern: /Template exceeds maximum size/i,
    category: 'validation_error',
    causes: [
      'Template **exceeds maximum allowed size**',
      'Template is too large for processing'
    ],
    fixCode: 'Increase maxTemplateSize or split template',
    fixComment: 'Set maxTemplateSize to a higher value',
    subjectFrom: null
  },
  INVALID_CONFIG: {
    name: 'INVALID_CONFIG',
    message: 'Invalid configuration: {key} must be >= 0',
    pattern: /^Invalid configuration: (.+) must be >= 0$/i,
    category: 'validation_error',
    titleTemplate: "Invalid configuration value for '{subject}'",
    causes: [
      'Invalid **configuration value**',
      'Negative timeout or size values are not allowed'
    ],
    fixCode: 'Set executionTimeout and maxTemplateSize to >= 0',
    fixComment: 'Use non-negative values for timeout and size',
    subjectFrom: firstCapture
  },
  TEMPLATE_MUST_BE_STRING: {
    name: 'TEMPLATE_MUST_BE_STRING',
    message: 'Template must be a string',
    pattern: /^Template must be a string$/i,
    category: 'validation_error',
    sourceFromStack: true,
    titleTemplate: "Template must be a string",
    causes: [
      'Template must be a **string**, got null/undefined',
      'Passed template is not a valid string'
    ],
    fixCode: 'Pass a valid template string',
    fixComment: 'Ensure template parameter is a string',
    subjectFrom: null
  },
  TEMPLATE_NULL: {
    name: 'TEMPLATE_NULL',
    message: 'Template is null',
    pattern: /^Template is null$/i,
    category: 'invalid_template',
    titleTemplate: "Template is null or undefined",
    causes: [
      'Template is **null** or **undefined**',
      'Passed template parameter is not a valid string'
    ],
    fixCode: 'Pass a valid template string',
    fixComment: 'Ensure template is a non-null string',
    subjectFrom: null
  },
  JS_STACK_SOURCE: {
    name: 'JS_STACK_SOURCE',
    message: 'template is null',
    pattern: /^template is null$/i,
    category: 'js_stack_source',
    sourceFromStack: true,
    titleTemplate: "Template parameter is null or invalid",
    causes: [
      '**Template parameter** is null or invalid',
      'Passed template is not a valid string'
    ],
    fixCode: 'Pass a valid template string',
    fixComment: 'Ensure template parameter is a string',
    subjectFrom: null
  }
} as const satisfies Record<string, ErrorDefinition>;

export type TemplateErrorName = keyof typeof TEMPLATE_ERRORS;
