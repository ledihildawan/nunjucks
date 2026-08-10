import { handleError } from './handle-error.ts';
import { isFatalStreamError } from './stream-fatal-codes.ts';

interface StreamErrorSentinel {
  readonly __streamError: true;
  readonly error: unknown;
  readonly lineno: number;
  readonly colno: number;
}

const isStreamErrorSentinel = (value: unknown): value is StreamErrorSentinel =>
  typeof value === 'object' && value !== null && (value as Record<string, unknown>).__streamError === true;

// WHY: streamError is the per-expression error recovery for streaming mode. Called from compiled template code's per-expression try/catch, it enriches the error (via handleError) but does NOT throw — instead returning a sentinel that createRenderStream detects and formats as an inline marker. The generator then continues to the next expression. handleError always throws (return type: never), so the catch is the only exit path.
// WHY: fatal codes (security/structural/system — see FATAL_STREAM_CODES) re-throw instead of becoming a sentinel. The throw escapes the compiled catch block, propagates up the async generator, and rides the existing mid-stream fatal path (createRenderStream catch → wrapWithLog → pipe-stream mid-stream handler). Recoverable codes still yield an inline marker and let the page continue.
const streamError = function(this: unknown, error: unknown, { lineno, colno }: { lineno: number; colno: number }): StreamErrorSentinel {
  // WHY: handleError always throws (return type: never). The catch is the only exit path — no fallthrough return needed.
  try {
    handleError.call(this, error, { lineno, colno });
  } catch (enriched) {
    if (isFatalStreamError(enriched)) { throw enriched; }
    return { __streamError: true, error: enriched, lineno, colno };
  }
  throw new Error('unreachable: handleError always throws');
};

export { streamError, isStreamErrorSentinel };
export type { StreamErrorSentinel };
