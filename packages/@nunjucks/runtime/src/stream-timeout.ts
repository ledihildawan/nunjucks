// WHY: carries code=ERROR_CODES.TIMEOUT so it is recognized by FATAL_STREAM_CODES (Tier 3 fatal) — the same code the blocking path's withTimeout emits — keeping streaming and blocking timeout errors shape-consistent. `kind` distinguishes idle (per-chunk) from deadline (total wall-clock) for observability without splitting the catalog code.
import { ERROR_CODES } from '@nunjucks/error-catalog';

/** Stream timeout error shape, recognized via `isStreamTimeout` and the `TIMEOUT` code. */
export interface StreamTimeoutError extends Error {
  isStreamTimeout: true;
  code: string;
  timeoutMs: number;
  kind: 'idle' | 'deadline';
}

/**
 * Creates a stream timeout error carrying `code: TIMEOUT` so the fatal-code
 * path recognizes it; `kind` distinguishes idle (per-chunk) from deadline
 * (total wall-clock) timeouts for observability.
 */
export const createStreamTimeoutError = (
  timeoutMs: number,
  kind: 'idle' | 'deadline' = 'idle'
): StreamTimeoutError => {
  const label =
    kind === 'deadline'
      ? `exceeded total deadline of ${timeoutMs}ms`
      : `chunk timed out after ${timeoutMs}ms`;
  const error = new Error(`Stream ${label}`) as StreamTimeoutError;
  error.name = 'StreamTimeoutError';
  error.isStreamTimeout = true;
  error.code = ERROR_CODES.TIMEOUT;
  error.timeoutMs = timeoutMs;
  error.kind = kind;
  return error;
};

/** Narrows to stream timeout errors via the `isStreamTimeout` marker. */
export const isStreamTimeoutError = (value: unknown): value is StreamTimeoutError =>
  typeof value === 'object' &&
  value !== null &&
  (value as { isStreamTimeout?: unknown }).isStreamTimeout === true;
