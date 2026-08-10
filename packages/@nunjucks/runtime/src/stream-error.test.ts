import { describe, test, expect } from 'bun:test';
import { streamError, isStreamErrorSentinel, type StreamErrorSentinel } from './stream-error.ts';

describe('streamError', () => {
  test('returns a sentinel with the enriched error', () => {
    const original = new Error('boom');
    const sentinel = streamError.call({}, original, { lineno: 5, colno: 10 });

    expect(isStreamErrorSentinel(sentinel)).toBe(true);
    expect(sentinel.lineno).toBe(5);
    expect(sentinel.colno).toBe(10);
  });

  test('the sentinel error carries the original message', () => {
    const original = new Error('something failed');
    const sentinel = streamError.call({}, original, { lineno: 0, colno: 0 });
    const error = sentinel.error as Error;

    expect(error.message).toBe('something failed');
  });

  test('does not throw — returns a value (generator continues)', () => {
    const original = new Error('should not throw');
    expect(() => streamError.call({}, original, { lineno: 1, colno: 1 })).not.toThrow();
  });
});

describe('streamError fatal-code handling', () => {
  test('re-throws an error whose code is in FATAL_STREAM_CODES instead of returning a sentinel', () => {
    // WHY: lineno on the crafted error makes handleError re-throw the original (handle-error.ts early-return path), so `.code` is preserved into streamError's catch where isFatalStreamError reads it.
    const fatal = Object.assign(new Error('timed out'), { code: 'TIMEOUT', lineno: 1 });
    expect(() => streamError.call({}, fatal, { lineno: 1, colno: 0 })).toThrow('timed out');
  });

  test('re-throws every fatal code (SANDBOX_CODE_EXECUTION, CIRCULAR_INCLUDE, TIMEOUT)', () => {
    for (const code of ['SANDBOX_CODE_EXECUTION', 'CIRCULAR_INCLUDE', 'TIMEOUT']) {
      const fatal = Object.assign(new Error(code), { code, lineno: 1 });
      expect(() => streamError.call({}, fatal, { lineno: 1, colno: 0 })).toThrow();
    }
  });

  test('returns a sentinel for a recoverable code even with lineno set', () => {
    const recoverable = Object.assign(new Error('null value'), { code: 'NULL_VALUE', lineno: 1 });
    const result = streamError.call({}, recoverable, { lineno: 1, colno: 0 });
    expect(isStreamErrorSentinel(result)).toBe(true);
  });
});

describe('isStreamErrorSentinel', () => {
  test('returns true for a StreamErrorSentinel', () => {
    const sentinel: StreamErrorSentinel = { __streamError: true, error: new Error('x'), lineno: 0, colno: 0 };
    expect(isStreamErrorSentinel(sentinel)).toBe(true);
  });

  test('returns false for a string', () => {
    expect(isStreamErrorSentinel('hello')).toBe(false);
  });

  test('returns false for null', () => {
    expect(isStreamErrorSentinel(null)).toBe(false);
  });

  test('returns false for a plain object without __streamError', () => {
    expect(isStreamErrorSentinel({ error: new Error('x') })).toBe(false);
  });
});
