import { ERROR_CODES } from '@nunjucks/error-catalog';
import type { ErrorGroup } from './error-route-types.ts';

// WHY: tier indicates which engine boundary caught the error — tier 1 is a recoverable inline
// expression failure (template continues), tier 2 is a recoverable render-time failure that
// aborts the current expression but yields a partial document, tier 3 is fatal and aborts the
// whole render. The catalog names each entry with what the engine reports, not what the user did.
export const errorGroups: ErrorGroup[] = [
  {
    name: 'UNDEFINED_VARIABLE',
    tier: 'tier 1',
    items: [
      { path: 'undefined-variable', desc: 'Variable not in context' },
      { path: 'undefined-value', desc: 'Nested property is null' },
      { path: 'undefined-value-match', desc: 'Attempted to output undefined value' },
      { path: 'inline-error', desc: 'Inline template undefined variable' },
      { path: 'key-not-found', desc: 'Key not found in context (strict mode)' },
      { path: 'sandbox-context-error', desc: 'Sandbox context error (undefined)' },
    ],
  },
  {
    name: 'UNDEFINED_FUNCTION',
    tier: 'tier 1',
    items: [
      { path: 'undefined-function', desc: 'Function not registered' },
      { path: 'container-error', desc: 'Container.get returns undefined' },
      { path: 'container-not-registered', desc: 'Container not registered' },
    ],
  },
  {
    name: 'UNDEFINED_FILTER',
    tier: 'tier 1',
    items: [
      { path: 'undefined-filter', desc: 'Filter not registered' },
      { path: 'sort-filter-attr', desc: 'Sort filter attribute undefined' },
      { path: 'groupby-filter', desc: 'Groupby filter requires an array' },
      { path: 'groupby-filter-attr', desc: 'Groupby filter attribute undefined' },
      { path: 'inline-filter-error', desc: 'Inline template undefined filter' },
    ],
  },
  {
    name: 'UNDEFINED_BLOCK',
    tier: 'tier 2',
    items: [
      { path: 'undefined-block', desc: 'Block not in parent template' },
      { path: 'unknown-block-runtime', desc: 'Block not found in parent at runtime' },
    ],
  },
  {
    name: 'NOT_A_FUNCTION',
    tier: 'tier 1',
    items: [{ path: 'not-a-function', desc: 'Calling non-function value' }],
  },
  {
    name: 'FILTER_TYPE_ERROR',
    tier: 'tier 1',
    items: [{ path: 'list-filter-error', desc: 'List filter requires iterable' }],
  },
  {
    name: 'OPERATOR_ERROR',
    tier: 'tier 1',
    items: [{ path: 'in-operator-error', desc: 'In operator on primitive type' }],
  },
  {
    name: 'FILTER_ATTR_ERROR',
    tier: 'tier 1',
    items: [
      { path: 'groupby-type-error', desc: 'Groupby attribute undefined' },
      { path: 'sort-type-error', desc: 'Sort attribute undefined' },
    ],
  },
  {
    name: 'PARSER_ERROR',
    tier: 'tier 3',
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
    ],
  },
  {
    name: 'DUPLICATE_BLOCK',
    tier: 'tier 3',
    items: [{ path: 'duplicate-block', desc: 'Duplicate block definition' }],
  },
  {
    name: 'RESERVED_KEYWORD_CONTEXT',
    tier: 'tier 3',
    items: [{ path: 'reserved-keyword', desc: 'Reserved keyword used as a function call' }],
  },
  {
    name: 'RUNTIME_ERROR',
    tier: 'tier 2',
    items: [
      { path: 'filter-error', desc: 'Filter throws during execution' },
      { path: 'no-super-block', desc: 'super() called without parent block' },
      { path: 'no-super-block-template', desc: 'super() in child template without parent block' },
      { path: 'filter-throw', desc: 'Inline filter throws during execution' },
    ],
  },
  {
    name: 'FILE_NOT_FOUND',
    tier: 'tier 3',
    items: [
      { path: 'circular-include', desc: 'Template includes itself' },
      { path: 'file-not-found', desc: 'Included template not found' },
      { path: 'filesystem-error', desc: 'Absolute path with non-existent file' },
      { path: 'import-error', desc: 'Cannot import symbol' },
    ],
  },
  {
    name: 'INVALID_INCLUDE',
    tier: 'tier 3',
    items: [{ path: 'invalid-include', desc: 'Non-string template name for include' }],
  },
  {
    name: ERROR_CODES.RENDER_ERROR,
    tier: 'tier 2',
    items: [
      { path: 'sandbox-context-modify', desc: 'Cannot modify sandboxed context' },
      { path: 'sandbox-allowlist', desc: 'Variable not in sandbox allowlist' },
      { path: 'reserved-keyword-filter', desc: 'Using reserved word as filter' },
      { path: 'reserved-keyword-global', desc: 'Using reserved word as global' },
      { path: 'template-size', desc: 'Template exceeds maximum size' },
      { path: 'invalid-config', desc: 'Invalid config (negative timeout)' },
      { path: 'sandbox-timeout', desc: 'Execution exceeds timeout limit' },
      { path: 'blocked-context-keys', desc: 'Context contains blocked keys (dynamic redaction)' },
      { path: 'blocked-custom-key', desc: 'Custom blocked key (no heuristic)' },
      { path: 'no-blocked-context-keys', desc: 'No blocked keys: library does not assume' },
      { path: 'dangerous-context', desc: 'Context contains dangerous values' },
      { path: 'dangerous-context-values', desc: 'Context values scanned for dangerous keys' },
      { path: 'dangerous-template', desc: 'Template contains dangerous code' },
    ],
  },
  {
    name: 'SANDBOX_ACCESS',
    tier: 'tier 1',
    items: [
      { path: 'sandbox-proto', desc: 'Sandbox blocks __proto__ access' },
      { path: 'sandbox-constructor', desc: 'Sandbox blocks constructor access' },
      { path: 'sandbox-process', desc: 'Sandbox blocks process access' },
      { path: 'sandbox-access', desc: 'Cannot access in sandbox mode' },
    ],
  },
  {
    name: 'TEMPLATE_MUST_BE_STRING',
    tier: 'tier 3',
    items: [
      { path: 'template-must-be-string', desc: 'Template must be string' },
      { path: 'template-null', desc: 'Template is null' },
    ],
  },
  {
    name: 'UNKNOWN',
    tier: '—',
    items: [{ path: 'container-factory', desc: 'Container factory error (unclear error type)' }],
  },
];
