import { ERROR_CODES } from '@nunjucks/error-catalog';

// WHY: severity determines how an error is displayed in the stream. BLOCK errors are structural/
// security/system failures that take up a full visual block in the output. INLINE errors are
// expression-level recoverable failures shown as compact markers that do not disrupt the document
// flow. This is purely a display concern — stream abort behavior is controlled separately by
// FATAL_STREAM_CODES in stream-fatal-codes.ts (which uses a narrower set: only security-critical
// codes that must abort regardless of streamErrorRecovery setting).

type ErrorSeverity = 'block' | 'inline';

const BLOCK_ERROR_CODES: ReadonlySet<string> = new Set([
  ERROR_CODES.CIRCULAR_INCLUDE,
  ERROR_CODES.TIMEOUT,
  ERROR_CODES.SANDBOX_CODE_EXECUTION,
  'ASSERT_TYPE_ERROR',
  'INVALID_INCLUDE',
  'UNDEFINED_BLOCK',
  'UNKNOWN_BLOCK_RUNTIME',
  'DUPLICATE_BLOCK',
  'NO_SUPER_BLOCK',
  'NO_SUPER_BLOCK_TEMPLATE',
  'RESERVED_KEYWORD_CONTEXT',
  'EXEC_EXPRESSION_ERROR',
  'IMPORT_ERROR',
  'FILESYSTEM_ERROR',
  'FILE_NOT_FOUND',
  'RENDER_ERROR',
  'INVALID_CONFIG',
  'TEMPLATE_SIZE_EXCEEDED',
]);

const readErrorCode = (error: unknown): string | null => {
  if (error === null || typeof error !== 'object') {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
};

const getSeverity = (error: unknown): ErrorSeverity => {
  const code = readErrorCode(error);
  return code !== null && BLOCK_ERROR_CODES.has(code) ? 'block' : 'inline';
};

export type { ErrorSeverity };
export { BLOCK_ERROR_CODES, getSeverity };
