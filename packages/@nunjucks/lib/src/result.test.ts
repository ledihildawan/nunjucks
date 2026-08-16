import { describe, test, expect } from 'bun:test';
import { ok, err, isOk, isErr, getOrElse } from './result.ts';
import type { Result } from './result.ts';

describe('ok', () => {
  test('constructs a success result carrying the value', () => {
    const result = ok(42);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  test('preserves reference and value types', () => {
    const payload = { name: 'nunjucks' };
    expect(ok(payload).value).toBe(payload);
  });
});

describe('err', () => {
  test('constructs a failure result carrying the error', () => {
    const result = err('boom');
    expect(result).toEqual({ ok: false, error: 'boom' });
  });
});

describe('isOk / isErr', () => {
  test('narrows a success result to its value', () => {
    const result: Result<number, string> = ok(7);
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
    if (isOk(result)) {
      expect(result.value).toBe(7);
    }
  });

  test('narrows a failure result to its error', () => {
    const result: Result<number, string> = err('missing');
    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
    if (isErr(result)) {
      expect(result.error).toBe('missing');
    }
  });
});

describe('getOrElse', () => {
  test('returns the value on success', () => {
    expect(getOrElse(ok('real'), 'fallback')).toBe('real');
  });

  test('returns the fallback on failure', () => {
    const lost: Result<string, unknown> = err('lost');
    expect(getOrElse(lost, 'fallback')).toBe('fallback');
  });
});
