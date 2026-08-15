import { ERROR_CODES } from '@nunjucks/error-catalog';
import { readObject, readString } from '@nunjucks/lib';

// WHY: error codes that MUST abort the stream even when streamErrorRecovery is enabled.
// These are security / structural / system failures where continuing to render would be
// unsafe or meaningless. streamError re-throws them (instead of returning a sentinel), so
// they flow through the existing mid-stream fatal path (createRenderStream catch →
// wrapWithLog → pipe-stream mid-stream error handler). Recoverable per-expression errors
// (data lookups, undefined values, filter input failures) stay inline markers.
const FATAL_STREAM_CODES: ReadonlySet<string> = new Set([
  ERROR_CODES.SANDBOX_CODE_EXECUTION,
  ERROR_CODES.CIRCULAR_INCLUDE,
  ERROR_CODES.TIMEOUT,
]);

const readErrorCode = (error: unknown): string | null => {
  const source = readObject(error);
  return readString(source.code);
};

const isFatalStreamError = (error: unknown): boolean => {
  const code = readErrorCode(error);
  return code !== null && FATAL_STREAM_CODES.has(code);
};

export { FATAL_STREAM_CODES, isFatalStreamError };
