import { handleError } from './handle-error.ts';

interface StreamErrorSentinel {
  readonly __streamError: true;
  readonly error: unknown;
  readonly lineno: number;
  readonly colno: number;
}

const isStreamErrorSentinel = (value: unknown): value is StreamErrorSentinel =>
  typeof value === 'object' && value !== null && (value as Record<string, unknown>).__streamError === true;

// WHY: streamError is the per-expression error recovery for streaming mode. Called from compiled template code's per-expression try/catch, it enriches the error (via handleError) but does NOT throw — instead returning a sentinel that createRenderStream detects and formats as an inline marker. The generator then continues to the next expression.
const streamError = function(this: unknown, error: unknown, { lineno, colno }: { lineno: number; colno: number }): StreamErrorSentinel {
  try {
    handleError.call(this, error, { lineno, colno });
  } catch (enriched) {
    return { __streamError: true, error: enriched, lineno, colno };
  }
  return { __streamError: true, error, lineno, colno };
};

export { streamError, isStreamErrorSentinel };
export type { StreamErrorSentinel };
