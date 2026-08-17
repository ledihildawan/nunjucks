import type { ERROR_DEFINITIONS } from './errors/index.ts';

// WHY: code names referenced by cross-package runtime logic (fatal-stream
// classification, timeout error factories) must derive from the catalog so
// renaming a definition breaks the build instead of silently drifting.
const catalogCode = <T extends keyof typeof ERROR_DEFINITIONS>(name: T): T => name;

const ERROR_CODES = {
  ASSERT_TYPE_ERROR: catalogCode('ASSERT_TYPE_ERROR'),
  CIRCULAR_INCLUDE: catalogCode('CIRCULAR_INCLUDE'),
  DANGEROUS_CONTEXT_VALUES: catalogCode('DANGEROUS_CONTEXT_VALUES'),
  DANGEROUS_TEMPLATE_CODE: catalogCode('DANGEROUS_TEMPLATE_CODE'),
  DUPLICATE_BLOCK: catalogCode('DUPLICATE_BLOCK'),
  EXEC_EXPRESSION_ERROR: catalogCode('EXEC_EXPRESSION_ERROR'),
  FILE_NOT_FOUND: catalogCode('FILE_NOT_FOUND'),
  FILESYSTEM_ERROR: catalogCode('FILESYSTEM_ERROR'),
  IMPORT_ERROR: catalogCode('IMPORT_ERROR'),
  INVALID_ASSIGN_TARGET: catalogCode('INVALID_ASSIGN_TARGET'),
  INVALID_CONFIG: catalogCode('INVALID_CONFIG'),
  INVALID_INCLUDE: catalogCode('INVALID_INCLUDE'),
  NO_SUPER_BLOCK: catalogCode('NO_SUPER_BLOCK'),
  NULL_VALUE: catalogCode('NULL_VALUE'),
  RANGE_EXCEEDED: catalogCode('RANGE_EXCEEDED'),
  RENDER_ERROR: catalogCode('RENDER_ERROR'),
  RESERVED_KEYWORD: catalogCode('RESERVED_KEYWORD'),
  RESERVED_KEYWORD_CONTEXT: catalogCode('RESERVED_KEYWORD_CONTEXT'),
  SANDBOX_CODE_EXECUTION: catalogCode('SANDBOX_CODE_EXECUTION'),
  STREAM_ALREADY_CONSUMED: catalogCode('STREAM_ALREADY_CONSUMED'),
  TEMPLATE_SIZE_EXCEEDED: catalogCode('TEMPLATE_SIZE_EXCEEDED'),
  TIMEOUT: catalogCode('TIMEOUT'),
  UNDEFINED_BLOCK: catalogCode('UNDEFINED_BLOCK'),
  UNDEFINED_PROPERTY: catalogCode('UNDEFINED_PROPERTY'),
  UNDEFINED_VARIABLE: catalogCode('UNDEFINED_VARIABLE'),
  UNKNOWN_BLOCK_RUNTIME: catalogCode('UNKNOWN_BLOCK_RUNTIME'),
} as const;

export { ERROR_CODES };
