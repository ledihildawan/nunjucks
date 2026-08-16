import { describe, test, expect } from 'bun:test';
import { ok, err, isOk, isErr, map, flatMap, getOrElse } from './result.ts';
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

describe('map', () => {
  test('transforms the success value', () => {
    expect(map(ok(3), (n) => n * 2)).toEqual({ ok: true, value: 6 });
  });

  test('propagates the error untouched', () => {
    const failed: Result<number, string> = err('nope');
    expect(map(failed, (n) => n * 2)).toEqual({ ok: false, error: 'nope' });
  });
});

describe('flatMap', () => {
  test('chains a success result into the next operation', () => {
    expect(flatMap(ok(2), (n) => ok(n + 5))).toEqual({ ok: true, value: 7 });
  });

  test('short-circuits on a success result that produces an error', () => {
    expect(flatMap(ok(2), (): Result<number, string> => err('overflow'))).toEqual({ ok: false, error: 'overflow' });
  });

  test('short-circuits on an incoming error', () => {
    const failed: Result<number, string> = err('bad');
    expect(flatMap(failed, (n) => ok(n + 5))).toEqual({ ok: false, error: 'bad' });
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
