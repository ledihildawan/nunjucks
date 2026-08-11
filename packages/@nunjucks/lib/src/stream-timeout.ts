// WHY: carries code='TIMEOUT' so it is recognized by FATAL_STREAM_CODES (Tier 3 fatal) — the same code the blocking path's withTimeout emits — keeping streaming and blocking timeout errors shape-consistent. `kind` distinguishes idle (per-chunk) from deadline (total wall-clock) for observability without splitting the catalog code.
export interface StreamTimeoutError extends Error {
  isStreamTimeout: true;
  code: string;
  timeoutMs: number;
  kind: 'idle' | 'deadline';
}

export const createStreamTimeoutError = (timeoutMs: number, kind: 'idle' | 'deadline' = 'idle'): StreamTimeoutError => {
  const label = kind === 'deadline' ? `exceeded total deadline of ${timeoutMs}ms` : `chunk timed out after ${timeoutMs}ms`;
  const error = new Error(`Stream ${label}`) as StreamTimeoutError;
  error.name = 'StreamTimeoutError';
  error.isStreamTimeout = true;
  error.code = 'TIMEOUT';
  error.timeoutMs = timeoutMs;
  error.kind = kind;
  return error;
};

export const isStreamTimeoutError = (value: unknown): value is StreamTimeoutError =>
  typeof value === 'object' && value !== null && (value as { isStreamTimeout?: unknown }).isStreamTimeout === true;
