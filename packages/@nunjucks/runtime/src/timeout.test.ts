import { describe, test, expect } from 'bun:test';
import { TimeoutError, withTimeout, withTimeoutSync } from './timeout.ts';

describe('TimeoutError', () => {
  test('uses default message and TIMEOUT code', () => {
    const err = new TimeoutError();
    expect(err.name).toBe('TimeoutError');
    expect(err.code).toBe('TIMEOUT');
    expect(err.message).toBe('Template execution timed out');
    expect(err).toBeInstanceOf(Error);
  });

  test('accepts a custom message', () => {
    const err = new TimeoutError('custom');
    expect(err.message).toBe('custom');
  });
});

describe('withTimeout', () => {
  test('returns the original promise when ms is not positive', async () => {
    const p = Promise.resolve(1);
    expect(withTimeout(p, 0)).toBe(p);
    expect(withTimeout(p, -5)).toBe(p);
  });

  test('returns the original promise when ms is undefined', async () => {
    const p = Promise.resolve(1);
    expect(withTimeout(p, undefined as unknown as number)).toBe(p);
  });

  test('resolves with the value when the promise finishes first', async () => {
    expect(await withTimeout(Promise.resolve(42), 1000)).toBe(42);
  });

  test('propagates rejection from the underlying promise', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom');
  });

  test('rejects with TimeoutError when the promise does not settle in time', async () => {
    const never = new Promise(() => {});
    await expect(withTimeout(never, 30)).rejects.toBeInstanceOf(TimeoutError);
    try {
      await withTimeout(new Promise(() => {}), 30);
    } catch (e) {
      expect((e as Error).message).toContain('timed out after 30ms');
    }
  });

  test('invokes onTimeout callback when timing out', async () => {
    let called = false;
    const never = new Promise(() => {});
    await expect(
      withTimeout(never, 30, () => { called = true; }),
    ).rejects.toBeInstanceOf(TimeoutError);
    expect(called).toBe(true);
  });

  test('does not invoke onTimeout when the promise settles in time', async () => {
    let called = false;
    await withTimeout(Promise.resolve(1), 1000, () => { called = true; });
    expect(called).toBe(false);
  });
});

describe('withTimeoutSync', () => {
  test('runs fn directly when ms is not positive', () => {
    expect(withTimeoutSync(() => 7, 0)).toBe(7);
    expect(withTimeoutSync(() => 7, -1)).toBe(7);
  });

  test('runs fn directly when ms is undefined', () => {
    expect(withTimeoutSync(() => 7, undefined as unknown as number)).toBe(7);
  });

  test('returns the function result', () => {
    expect(withTimeoutSync(() => 'done', 1000)).toBe('done');
  });

  test('propagates errors thrown by fn', () => {
    expect(() => withTimeoutSync(() => { throw new Error('sync boom'); }, 1000)).toThrow('sync boom');
  });
});
