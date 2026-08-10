import type { ErrorGroup } from './types.ts';

export const errorGroups: ErrorGroup[] = [
  {
    name: 'UNDEFINED_VARIABLE',
    items: [
      { path: 'undefined-variable', desc: 'Variable not in context' },
      { path: 'undefined-value', desc: 'Nested property is null' },
      { path: 'undefined-value-match', desc: 'Attempted to output undefined value' },
      { path: 'inline-error', desc: 'Inline template undefined variable' },
      { path: 'key-not-found', desc: 'Key not found in context (strict mode)' },
      { path: 'sandbox-context-error', desc: 'Sandbox context error (undefined)' },
    ]
  },
  {
    name: 'UNDEFINED_FUNCTION',
    items: [
      { path: 'undefined-function', desc: 'Function not registered' },
      { path: 'container-error', desc: 'Container get returns undefined' },
      { path: 'container-not-registered', desc: 'Container not registered' },
      { path: 'sandbox-timeout', desc: 'Sandbox timeout function not found' },
    ]
  },
  {
    name: 'UNDEFINED_FILTER',
    items: [
      { path: 'undefined-filter', desc: 'Filter not registered' },
      { path: 'sort-filter-attr', desc: 'Sort filter attribute undefined' },
      { path: 'groupby-filter', desc: 'Groupby filter requires an array' },
      { path: 'groupby-filter-attr', desc: 'Groupby filter attribute undefined' },
      { path: 'dictsort-filter', desc: 'Dictsort filter requires object' },
      { path: 'dictsort-filter-by', desc: 'Dictsort filter by mode invalid' },
      { path: 'inline-filter-error', desc: 'Inline template undefined filter' },
    ]
  },
  {
    name: 'UNDEFINED_BLOCK',
    items: [
      { path: 'undefined-block', desc: 'Block not in parent template' },
      { path: 'unknown-block-runtime', desc: 'Block not found in parent' },
    ]
  },
  {
    name: 'NOT_A_FUNCTION',
    items: [
      { path: 'not-a-function', desc: 'Calling non-function value' },
    ]
  },
  {
    name: 'FILTER_TYPE_ERROR',
    items: [
      { path: 'list-filter-error', desc: 'List filter requires iterable' },
    ]
  },
  {
    name: 'OPERATOR_ERROR',
    items: [
      { path: 'in-operator-error', desc: 'In operator on primitive type' },
    ]
  },
  {
    name: 'FILTER_ATTR_ERROR',
    items: [
      { path: 'groupby-type-error', desc: 'Groupby attribute undefined' },
      { path: 'sort-type-error', desc: 'Sort attribute undefined' },
      { path: 'dictsort-value-error', desc: 'Dictsort requires object' },
      { path: 'dictsort-by-error', desc: 'Dictsort invalid by param' },
    ]
  },
  {
    name: 'PARSER_ERROR',
    items: [
      { path: 'syntax-error', desc: 'Invalid template syntax' },
      { path: 'parser-expected', desc: 'Parser expected different token' },
      { path: 'inline-syntax-error', desc: 'Inline template syntax error' },
      { path: 'invalid-lookup', desc: 'Invalid bracket notation' },
      { path: 'unknown-block-tag', desc: 'Unknown block tag' },
      { path: 'expected-variable-end', desc: 'Expected variable end' },
      { path: 'parser-unexpected-token', desc: 'Unexpected token while parsing' },
      { path: 'sandbox-code-execution', desc: 'Code execution blocked (parser)' },
      { path: 'slice-error', desc: 'Slice step cannot be zero' },
    ]
  },
  {
    name: 'DUPLICATE_BLOCK',
    items: [
      { path: 'duplicate-block', desc: 'Duplicate block definition' },
    ]
  },
  {
    name: 'RESERVED_KEYWORD_CONTEXT',
    items: [
      { path: 'reserved-keyword', desc: 'Reserved keyword used as a function call' },
    ]
  },
  {
    name: 'RUNTIME_ERROR',
    items: [
      { path: 'filter-error', desc: 'Filter throws during execution' },
      { path: 'no-super-block', desc: 'super() called without parent block' },
      { path: 'filter-throw', desc: 'Inline filter throws during execution' },
    ]
  },
  {
    name: 'FILE_NOT_FOUND',
    items: [
      { path: 'no-super-block-template', desc: 'super() in child without parent block' },
      { path: 'circular-include', desc: 'Template includes itself' },
      { path: 'file-not-found', desc: 'Included template not found' },
      { path: 'filesystem-error', desc: 'Absolute path with non-existent file' },
      { path: 'import-error', desc: 'Cannot import symbol' },
    ]
  },
  {
    name: 'INVALID_INCLUDE',
    items: [
      { path: 'invalid-include', desc: 'Non-string template name for include' },
    ]
  },
  {
    name: 'RENDER_ERROR',
    items: [
      { path: 'sandbox-context-modify', desc: 'Cannot modify sandboxed context' },
      { path: 'sandbox-allowlist', desc: 'Variable not in sandbox allowlist' },
      { path: 'reserved-keyword-filter', desc: 'Using reserved word as filter' },
      { path: 'reserved-keyword-global', desc: 'Using reserved word as global' },
      { path: 'template-size', desc: 'Template exceeds maximum size' },
      { path: 'invalid-config', desc: 'Invalid config (negative timeout)' },
      { path: 'blocked-context-keys', desc: 'Context contains blocked keys (dynamic redaction)' },
      { path: 'blocked-custom-key', desc: 'Custom blocked key (no heuristic)' },
      { path: 'no-blocked-context-keys', desc: 'No blocked keys: library does not assume' },
      { path: 'dangerous-context', desc: 'Context contains dangerous values' },
      { path: 'dangerous-template', desc: 'Template contains dangerous code' },
    ]
  },
  {
    name: 'SANDBOX_ACCESS',
    items: [
      { path: 'sandbox-proto', desc: 'Sandbox blocks __proto__ access' },
      { path: 'sandbox-constructor', desc: 'Sandbox blocks constructor access' },
      { path: 'sandbox-process', desc: 'Sandbox blocks process access' },
      { path: 'sandbox-access', desc: 'Cannot access in sandbox mode' },
    ]
  },
  {
    name: 'TEMPLATE_MUST_BE_STRING',
    items: [
      { path: 'template-must-be-string', desc: 'Template must be string' },
      { path: 'template-null', desc: 'Template is null' },
    ]
  },
  {
    name: 'UNKNOWN',
    items: [
      { path: 'container-factory', desc: 'Container factory error (unclear error type)' },
    ]
  },
];
