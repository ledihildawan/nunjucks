import { createInternalInvariantError } from '@nunjucks/error-catalog';
import { isKeyedObject } from '@nunjucks/lib';
import { handleError } from './handle-error.ts';
import { isFatalStreamError } from './stream-fatal-codes.ts';

/**
 * Recoverable per-expression error envelope for streaming renders; the stream
 * consumer detects it and formats an inline marker instead of aborting.
 */
interface StreamErrorSentinel {
  readonly __nunjucks_stream_error__: true;
  readonly error: unknown;
  readonly lineno: number;
  readonly colno: number;
}

/**
 * Narrows to the stream-error sentinel (`__nunjucks_stream_error__`).
 *
 * @param value - The value to check.
 * @returns `true` if the value is a stream error sentinel.
 */
const isStreamErrorSentinel = (value: unknown): value is StreamErrorSentinel =>
  isKeyedObject(value) &&
  (value as { __nunjucks_stream_error__?: unknown }).__nunjucks_stream_error__ === true;

/**
 * Per-expression error recovery for streaming renders. Enriches the error via
 * handleError but does NOT throw — returns a sentinel that createRenderStream
 * detects and formats as an inline marker. Fatal codes (security/structural/system)
 * re-throw and abort the stream; recoverable codes yield an inline marker.
 *
 * @param this - Runtime context carrying template name and phase.
 * @param error - The error caught during expression evaluation.
 * @param options - Source line and column position.
 * @returns A stream error sentinel for recoverable errors.
 * @throws {Error} For fatal error codes (security/structural/system).
 */
const streamError = function (
  this: unknown,
  error: unknown,
  { lineno, colno }: { lineno: number; colno: number }
): StreamErrorSentinel {
  try {
    handleError.call(this, error, { lineno, colno });
  } catch (enriched: unknown) {
    if (isFatalStreamError(enriched)) {
      throw enriched;
    }
    return { __nunjucks_stream_error__: true, error: enriched, lineno, colno };
  }
  // WHY: handleError never returns (return type: never) — this assignment silences TypeScript's unreachable-code error while preserving the intent that this line is truly unreachable.
  const unreachableMarker: never = (() => {
    throw createInternalInvariantError('handleError always throws');
  })();
  return unreachableMarker as StreamErrorSentinel;
};

export type { StreamErrorSentinel };
export { isStreamErrorSentinel, streamError };
