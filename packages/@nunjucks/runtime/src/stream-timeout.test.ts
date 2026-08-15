import { describe, expect, test } from 'bun:test';
import { ERROR_CODES } from '@nunjucks/error-catalog';
import { createStreamTimeoutError, isStreamTimeoutError } from './stream-timeout.ts';

describe('createStreamTimeoutError', () => {
  test('builds an idle timeout error with the catalog TIMEOUT code', () => {
    const error = createStreamTimeoutError(250);
    expect(error.name).toBe('StreamTimeoutError');
    expect(error.isStreamTimeout).toBe(true);
    expect(error.code).toBe(ERROR_CODES.TIMEOUT);
    expect(error.timeoutMs).toBe(250);
    expect(error.kind).toBe('idle');
    expect(error.message).toContain('chunk timed out after 250ms');
  });

  test('builds a deadline timeout error with deadline wording', () => {
    const error = createStreamTimeoutError(5000, 'deadline');
    expect(error.kind).toBe('deadline');
    expect(error.message).toContain('exceeded total deadline of 5000ms');
  });
});

describe('isStreamTimeoutError', () => {
  test('recognizes stream timeout errors', () => {
    expect(isStreamTimeoutError(createStreamTimeoutError(10))).toBe(true);
  });

  test('rejects plain errors and non-objects', () => {
    expect(isStreamTimeoutError(new Error('plain'))).toBe(false);
    expect(isStreamTimeoutError(null)).toBe(false);
    expect(isStreamTimeoutError('StreamTimeoutError')).toBe(false);
  });
});
