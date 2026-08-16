import { ERROR_CODES } from '@nunjucks/error-catalog';
import { readErrorCode } from '@nunjucks/lib';

// WHY: severity determines how an error is displayed in the stream. BLOCK errors are structural/
// security/system failures that take up a full visual block in the output. INLINE errors are
// expression-level recoverable failures shown as compact markers that do not disrupt the document
// flow. This is purely a display concern — stream abort behavior is controlled separately by
// FATAL_STREAM_CODES in stream-fatal-codes.ts (which uses a narrower set: only security-critical
// codes that must abort regardless of streamErrorRecovery setting).

// WHY: DisplaySeverity, not ErrorSeverity — the catalog's ErrorSeverity is the
// error/warning/info axis; this type is the stream-display axis (block vs inline marker).
type DisplaySeverity = 'block' | 'inline';

const BLOCK_ERROR_CODES: ReadonlySet<string> = new Set([
  ERROR_CODES.ASSERT_TYPE_ERROR,
  ERROR_CODES.CIRCULAR_INCLUDE,
  ERROR_CODES.DUPLICATE_BLOCK,
  ERROR_CODES.EXEC_EXPRESSION_ERROR,
  ERROR_CODES.FILE_NOT_FOUND,
  ERROR_CODES.FILESYSTEM_ERROR,
  ERROR_CODES.IMPORT_ERROR,
  ERROR_CODES.INVALID_CONFIG,
  ERROR_CODES.INVALID_INCLUDE,
  ERROR_CODES.NO_SUPER_BLOCK,
  ERROR_CODES.RENDER_ERROR,
  ERROR_CODES.RESERVED_KEYWORD_CONTEXT,
  ERROR_CODES.SANDBOX_CODE_EXECUTION,
  ERROR_CODES.TEMPLATE_SIZE_EXCEEDED,
  ERROR_CODES.TIMEOUT,
  ERROR_CODES.UNDEFINED_BLOCK,
  ERROR_CODES.UNKNOWN_BLOCK_RUNTIME,
]);

const getSeverity = (error: unknown): DisplaySeverity => {
  const code = readErrorCode(error);
  return code !== null && BLOCK_ERROR_CODES.has(code) ? 'block' : 'inline';
};

export type { DisplaySeverity };
export { BLOCK_ERROR_CODES, getSeverity };
