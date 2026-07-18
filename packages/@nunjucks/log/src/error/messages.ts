type CaptureGroup = string;

interface CreateErrorOptions {
  name: string;
  template: string;
  captureGroups?: CaptureGroup[];
  customPattern?: RegExp | null;
}

interface ErrorDefinitionEntry {
  name: string;
  message: (args?: Record<string, string> | CaptureGroup[]) => string;
  pattern: RegExp;
}

const createError = (
  name: string,
  template: string,
  captureGroups: CaptureGroup[] = [],
  customPattern: RegExp | null = null
): ErrorDefinitionEntry => {
  const message = (...args: unknown[]): string => {
    let params: Record<string, string>;
    if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
      params = args[0] as Record<string, string>;
    } else {
      params = {};
      captureGroups.forEach((key, i) => {
        if (args[i] !== undefined && args[i] !== null) params[key] = String(args[i]);
      });
    }
    return template.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
  };

  const patternStr = template
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\{(\w+)\\\}/g, '(.+)');

  const pattern = customPattern || new RegExp(`^${patternStr}$`, 'i');

  return { name, message, pattern };
};

export const ERROR_DEFINITIONS = {
  UNDEFINED_VARIABLE: createError('UNDEFINED_VARIABLE', "Variable '{name}' is not defined", ['name'], /^Variable '([^']+)' is not defined$/i),
  UNDEFINED_FUNCTION: createError('UNDEFINED_FUNCTION', "Function '{name}' is not defined", ['name'], /^Function '([^']+)' is not defined$/i),
  NOT_A_FUNCTION: createError('NOT_A_FUNCTION', "'{name}' is not a function", ['name'], /^'([^']+)' is not a function$/i),
  UNDEFINED_BLOCK: createError('UNDEFINED_BLOCK', 'Undefined block: {name}', ['name'], /^Undefined block: (.+)$/i),
  UNDEFINED_FILTER: createError('UNDEFINED_FILTER', "Filter '{name}' is not defined", ['name'], /^Filter '([^']+)' is not defined$/i),
  UNDEFINED_TEST: createError('UNDEFINED_TEST', "Test '{name}' is not defined", ['name'], /^Test '([^']+)' is not defined$/i),
  FILTER_ERROR: createError('FILTER_ERROR', "Filter failed", [], /^Error: Filter .+? threw|filter threw|Filter .+? failed/i),
  FILTER_TYPE_ERROR: createError('FILTER_TYPE_ERROR', "Filter type error", [], /attribute "([^"]+)" resolved to undefined/i),
  UNKNOWN_BLOCK_TAG: createError('UNKNOWN_BLOCK_TAG', "unknown block tag: {tag}", ['tag'], /^unknown block tag: (.+)$/i),
  UNKNOWN_BLOCK_RUNTIME: createError('UNKNOWN_BLOCK_RUNTIME', 'unknown block "{name}"', ['name'], /^unknown block "([^"]+)"$|parent has no block|called super\(\) in a block without parent/i),
  DUPLICATE_BLOCK: createError('DUPLICATE_BLOCK', 'Block "{name}" defined more than once', ['name'], /^Block "([^"]+)" defined more than once$/i),
  NO_SUPER_BLOCK: createError('NO_SUPER_BLOCK', 'No super block available', [], /no super block available|called super\(\) in a block without parent/i),
  EXPECTED_VARIABLE_END: createError('EXPECTED_VARIABLE_END', 'expected variable end', [], /^expected variable end$/i),
  SYNTAX_ERROR: createError('SYNTAX_ERROR', 'Syntax error', [], /^Unexpected token|unexpected end of file|unexpected end of template|unexpected token:|parse error|Parse error|Unexpected end of input|^expected arguments$|^expected (?:comma|right bracket|block end|endtry|elif|else|endif)|^tag name expected|^invalid boolean|^expected expression, got end of file|^expected [a-zA-Z]+(?:, got [a-zA-Z.]+)?$/i),
  PARSER_UNEXPECTED_TOKEN: createError('PARSER_UNEXPECTED_TOKEN', "Unexpected token '{token}' while parsing", ['token']),
  PARSER_EXPECTED: createError('PARSER_EXPECTED', 'expected {expected}', ['expected']),
  PARSER_EXPECTED_IN: createError('PARSER_EXPECTED_IN', 'expected "in" keyword for loop', [], /parseFor: expected "in" keyword for loop|^expected "in" keyword for loop$/i),
  PARSER_VARIABLE_NAME: createError('PARSER_VARIABLE_NAME', 'variable name expected', [], /(?:parseBlock|parseFor): variable name expected|^variable name expected$/i),
  PARSER_TAG_NAME: createError('PARSER_TAG_NAME', 'tag name expected', [], /^tag name expected$|parse(?:Block|From|TemplateRef|FilterStatement|If|Import|Include): expected [a-zA-Z]+$/i),
  PARSER_EXPRESSION: createError('PARSER_EXPRESSION', 'expected expression', [], /^expected expression, got end of file$|parseAggregate: expected (?:comma|colon)/i),
  PARSER_ERROR: createError('PARSER_ERROR', 'Unexpected value while parsing', [], /^Unexpected value while parsing$/i),
  PARSER_PUSH_TOKEN: createError('PARSER_PUSH_TOKEN', 'can only push one token', [], /can only push one token/i),

  SLICE_STEP: createError('SLICE_STEP', 'slice: step cannot be zero', []),
  LIST_FILTER: createError('LIST_FILTER', "list: '{type}' is not iterable", ['type'], /^list: '([^']+)' is not iterable$/i),
  SORT_FILTER: createError('SORT_FILTER', 'sort: expected array, got {type}', ['type'], /^sort: expected array, got (.+)$/i),
  SORT_FILTER_ATTR: createError('SORT_FILTER_ATTR', "sort: attribute '{attr}' does not exist on object", ['attr'], /^sort: attribute '([^']+)' does not exist on object$/i),
  GROUPBY_FILTER: createError('GROUPBY_FILTER', 'groupby: expected array, got {type}', ['type'], /^groupby: expected array, got (.+)$/i),
  GROUPBY_FILTER_ATTR: createError('GROUPBY_FILTER_ATTR', "groupby: attribute '{attr}' does not exist on object", ['attr'], /^groupby: attribute '([^']+)' does not exist on object$/i),
  DICTSDICT_FILTER: createError('DICTSDICT_FILTER', 'dictsort: expected object, got {type}', ['type'], /^dictsort: expected object, got (.+)$/i),
  DICTSDICT_FILTER_BY: createError('DICTSDICT_FILTER_BY', "dictsort: invalid sort mode '{by}'. Must be 'key' or 'value'", ['by'], /^dictsort: invalid sort mode '([^']+)'\. Must be 'key' or 'value'$/i),

  IN_OPERATOR: createError('IN_OPERATOR', "Cannot use 'in' operator to search for '{key}' in {type}", ['key', 'type'], /^Cannot use 'in' operator to search for '([^']+)' in (.+)$/i),
  TIMEOUT: createError('TIMEOUT', 'Template rendering timed out after {ms}ms', ['ms'], /^Template rendering timed out after (\d+)ms$/i),
  BLOCKED_CONTEXT_KEYS: createError('BLOCKED_CONTEXT_KEYS', 'Cannot use blocked keys in context: {keys}', ['keys'], /^Cannot use blocked keys in context: (.+)$/i),
  DANGEROUS_CONTEXT_VALUES: createError('DANGEROUS_CONTEXT_VALUES', 'Context contains unsafe values: {values}', ['values'], /^Context contains unsafe values: (.+)$/i),
  DANGEROUS_CONTEXT_VALUE_SCRUBBED: createError('DANGEROUS_CONTEXT_VALUE_SCRUBBED', 'Scrubbed unsafe values from context: {values}', ['values'], /^Scrubbed unsafe values from context: (.+)$/i),
  DANGEROUS_TEMPLATE_CODE: createError('DANGEROUS_TEMPLATE_CODE', 'Template contains unsafe code: {violations}', ['violations'], /^Template contains unsafe code: (.+)$/i),
  INVALID_LOOKUP: createError('INVALID_LOOKUP', 'expected name as lookup value after {marker} on {target}, got {value}', ['marker', 'target', 'value'], /expected name as lookup value after (dot|\?\.) on (.+), got (.+)$/i),
  CIRCULAR_INCLUDE: createError('CIRCULAR_INCLUDE', 'Circular include detected: {path}', ['path'], /^Circular include detected: (.+)$/i),
  FILE_NOT_FOUND: createError('FILE_NOT_FOUND', 'template not found: {path}', ['path'], /^template not found: (.+)$/i),
  FILESYSTEM_ERROR: createError('FILESYSTEM_ERROR', 'Filesystem error: {msg}', ['msg'], /^Filesystem error: (.+)$/i),
  INVALID_INCLUDE: createError('INVALID_INCLUDE', 'template names must be a string', [], /^template names must be a string$/i),
  IMPORT_ERROR: createError('IMPORT_ERROR', "Cannot import '{name}' from module", ['name'], /^Cannot import '([^']+)' from module$|^cannot find module.*\.njm/i),
  VALIDATION_ERROR: createError('VALIDATION_ERROR', "Invalid value for '{key}'", ['key'], /^Invalid value for '([^']+)'$/i),
  INVALID_BOOLEAN: createError('INVALID_BOOLEAN', 'invalid boolean', [], /^invalid boolean(?:: .+)?$/i),
  RESERVED_KEYWORD: createError('RESERVED_KEYWORD', "Cannot use reserved {type} '{name}'", ['type', 'name'], /^Cannot use reserved (.+) '([^']+)'$/i),
  RESERVED_KEYWORD_CONTEXT: createError('RESERVED_KEYWORD_CONTEXT', "Cannot use reserved keyword '{name}' outside of its intended context", ['name'], /reserved keyword.*context|cannot use.*reserved keyword|caller.*only available|only available inside.*call/i),
  KEY_NOT_FOUND: createError('KEY_NOT_FOUND', "Key '{key}' not found", ['key'], /^Key '([^']+)' not found$/i),
  ASSERT_TYPE_ERROR: createError('ASSERT_TYPE_ERROR', 'Invalid type assertion', [], /^assertType: invalid type: /i),

  SANDBOX_ACCESS: createError('SANDBOX_ACCESS', "Cannot access '{key}' in sandbox mode", ['key'], /^Cannot access '([^']+)' in sandbox mode$/i),
  SANDBOX_SET: createError('SANDBOX_SET', "Cannot set '{key}' in sandbox mode", ['key'], /^Cannot set '([^']+)' in sandbox mode$/i),
  SANDBOX_ALLOWLIST: createError('SANDBOX_ALLOWLIST', "'{key}' is not allowed in sandbox mode. Add it to allowlist.", ['key'], /^'([^']+)' is not allowed in sandbox mode\. Add it to allowlist\.$/i),
  SANDBOX_CONTEXT_MODIFY: createError('SANDBOX_CONTEXT_MODIFY', 'Cannot modify context in sandbox mode', [], /^Cannot modify context in sandbox mode$/i),
  SANDBOX_CODE_EXECUTION: createError('SANDBOX_CODE_EXECUTION', 'Code execution is blocked', [], /Sandbox: Code execution.*is blocked/i),
  SANDBOX_TIMEOUT_EXEC: createError('SANDBOX_TIMEOUT_EXEC', 'Sandbox timeout', [], /frame\.push is not a function/i),
  SANDBOX_CONTEXT_ERROR: createError('SANDBOX_CONTEXT_ERROR', 'Sandbox context error', [], /Value is not a function/i),
  SANDBOX_PROTO_ACCESS: createError('SANDBOX_PROTO_ACCESS', 'Sandbox proto access', [], /Cannot read properties of undefined \(reading 'charAt'\)/i),

  CONTAINER_FACTORY: createError('CONTAINER_FACTORY', "Container: factory for '{name}' must be a function, got {type}", ['name', 'type'], /^Container: factory for '([^']+)' must be a function, got (.+)$/i),
  CONTAINER_NOT_REGISTERED: createError('CONTAINER_NOT_REGISTERED', "Container: '{name}' is not registered. Did you forget to register it?", ['name'], /^Container: '([^']+)' is not registered\. Did you forget to register it\?$/i),
  CONTAINER_ERROR: createError('CONTAINER_ERROR', 'Container error', [], /Container: (?:factory for '([^']+)'|'([^']+)' is not registered)/i),

  TEMPLATE_INVALID_SOURCE: createError('TEMPLATE_INVALID_SOURCE', "Invalid template source: expected 'code' or 'string', got '{type}'", ['type'], /src must be a string or an object describing the source/i),
  TEMPLATE_SRC_STRING: createError('TEMPLATE_SRC_STRING', 'Template src must be a string or an object', [], /^Template src must be a string or an object$/i),
  TEMPLATE_NO_RENDER: createError('TEMPLATE_NO_RENDER', 'Template object is invalid: missing render method', [], /Unexpected template object type/i),
  INVALID_CODE_FORMAT: createError('INVALID_CODE_FORMAT', 'Invalid template: expected compiled template to start with "async function root"', [], /Unrecognized code format/i),
  WALK_UNKNOWN_TYPE: createError('WALK_UNKNOWN_TYPE', "walk: unknown node type '{type}'", ['type'], /walk: unknown (?:node type|typename)/i),
  TEMPLATE_SIZE_EXCEEDED: createError('TEMPLATE_SIZE_EXCEEDED', 'Template exceeds maximum size of {max} bytes', ['max'], /Template exceeds maximum size/i),
  INVALID_CONFIG: createError('INVALID_CONFIG', 'Invalid configuration: {key} must be >= 0', ['key'], /^Invalid configuration: (.+) must be >= 0$/i),
  TEMPLATE_MUST_BE_STRING: createError('TEMPLATE_MUST_BE_STRING', 'Template must be a string', [], /^Template must be a string$/i),
  TEMPLATE_NULL: createError('TEMPLATE_NULL', 'Template is null', [], /^Template is null$/i),
  JS_STACK_SOURCE: createError('JS_STACK_SOURCE', 'template is null', [], /^template is null$/i),

  UNDEFINED_VALUE_MATCH: createError('UNDEFINED_VALUE_MATCH', 'Attempted to output undefined value', [], /attempted to output (?:null|undefined) value/i),
  CALL_MATCH: createError('CALL_MATCH', 'Unable to call', [], /Unable to call `([^`]+)`/),
  OUTPUT_MATCH: createError('OUTPUT_MATCH', 'Attempted to output', [], /attempted to output '([^']+)'/i),
  LINE_INFO_MATCH: createError('LINE_INFO_MATCH', 'Line info', [], /\[Line (\d+)(?:, Column (\d+))?\]/i),
  COLUMN_INFO_MATCH: createError('COLUMN_INFO_MATCH', 'Column info', [], /Column (\d+)/i),
  INCLUDED_FROM_MATCH: createError('INCLUDED_FROM_MATCH', 'Included from', [], /\(included from ([^:)]+\.html)(?::\d+)?(?::\d+)?\)/),
  INCLUDED_FROM_WITH_LINE_MATCH: createError('INCLUDED_FROM_WITH_LINE_MATCH', 'Included from with line', [], /\(included from ([^:]+\.html):(\d+)(?::(\d+))?\)/),
} as const;

export type ErrorName = keyof typeof ERROR_DEFINITIONS;

export type ErrorMessageFn = (args?: Record<string, string> | string[]) => string;

export const ERRORS: Record<ErrorName, ErrorMessageFn> = Object.fromEntries(
  Object.values(ERROR_DEFINITIONS).map(({ name, message }) => [name, message])
) as Record<ErrorName, ErrorMessageFn>;

export const PATTERNS: Record<ErrorName, RegExp> = Object.fromEntries(
  Object.values(ERROR_DEFINITIONS).map(({ name, pattern }) => [name, pattern])
) as Record<ErrorName, RegExp>;
