import { describe, test, expect } from 'bun:test';
import { wrapFilterWithError, wrapAsyncFilter } from './filter-wrappers.js';

describe('wrapFilterWithError', () => {
  test('wraps sync filter that succeeds', () => {
    const filter = (x) => x * 2;
    const wrapped = wrapFilterWithError(filter, 'double');
    expect(wrapped(5)).toBe(10);
  });

  test('tags error with code and subject on throw', () => {
    const filter = () => { throw new Error('bad'); };
    const wrapped = wrapFilterWithError(filter, 'myFilter');
    expect(() => wrapped()).toThrow('bad');
    try { wrapped(); } catch (e) {
      expect(e.code).toBe('FILTER_ERROR');
      expect(e.subject).toBe('myFilter');
    }
  });

  test('preserves existing error code', () => {
    const filter = () => { const e = new Error('existing'); e.code = 'EXISTING'; throw e; };
    const wrapped = wrapFilterWithError(filter, 'myFilter');
    try { wrapped(); } catch (e) {
      expect(e.code).toBe('EXISTING');
    }
  });

  test('preserves this context', () => {
    const filter = function(x) { return this.multiplier * x; };
    const wrapped = wrapFilterWithError(filter, 'double');
    const ctx = { multiplier: 3 };
    expect(wrapped.call(ctx, 4)).toBe(12);
  });

  test('handles promises in args', async () => {
    const filter = (a, b) => a + b;
    const wrapped = wrapFilterWithError(filter, 'add');
    const result = await wrapped(Promise.resolve(3), Promise.resolve(4));
    expect(result).toBe(7);
  });

  test('tags error from async args path', async () => {
    const filter = () => { throw new Error('fail'); };
    const wrapped = wrapFilterWithError(filter, 'bad');
    try {
      await wrapped(Promise.resolve(1));
    } catch (e) {
      expect(e.code).toBe('FILTER_ERROR');
    }
  });
});

describe('wrapAsyncFilter', () => {
  test('wraps async filter that succeeds', async () => {
    const filter = async (x) => x * 2;
    const wrapped = wrapAsyncFilter(filter, 'double');
    expect(await wrapped(5)).toBe(10);
  });

  test('tags error with code and subject on throw', async () => {
    const filter = async () => { throw new Error('bad'); };
    const wrapped = wrapAsyncFilter(filter, 'myFilter');
    try { await wrapped(); } catch (e) {
      expect(e.code).toBe('FILTER_ERROR');
      expect(e.subject).toBe('myFilter');
    }
  });

  test('resolves promise args before calling', async () => {
    const filter = async (a, b) => a + b;
    const wrapped = wrapAsyncFilter(filter, 'add');
    const result = await wrapped(Promise.resolve(10), Promise.resolve(20));
    expect(result).toBe(30);
  });

  test('tags error from resolved args', async () => {
    const filter = async () => { throw new Error('async fail'); };
    const wrapped = wrapAsyncFilter(filter, 'bad');
    try { await wrapped(Promise.resolve(1)); } catch (e) {
      expect(e.code).toBe('FILTER_ERROR');
    }
  });

  test('preserves this context', async () => {
    const filter = async function(x) { return this.mult * x; };
    const wrapped = wrapAsyncFilter(filter, 'scale');
    const ctx = { mult: 10 };
    expect(await wrapped.call(ctx, 7)).toBe(70);
  });
});
