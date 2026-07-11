import { describe, test, expect } from 'bun:test';
import { wrapAsyncFilter } from './filter-wrappers.js';

describe('wrapAsyncFilter', () => {
  test('wraps sync filter that succeeds', async () => {
    const filter = (x) => x * 2;
    const wrapped = wrapAsyncFilter(filter, 'double');
    expect(await wrapped(5)).toBe(10);
  });

  test('wraps async filter that succeeds', async () => {
    const filter = async (x) => x * 2;
    const wrapped = wrapAsyncFilter(filter, 'double');
    expect(await wrapped(5)).toBe(10);
  });

  test('tags error with code and subject on throw', async () => {
    const filter = () => { throw new Error('bad'); };
    const wrapped = wrapAsyncFilter(filter, 'myFilter');
    try { await wrapped(); } catch (e) {
      expect(e.code).toBe('FILTER_ERROR');
      expect(e.subject).toBe('myFilter');
    }
  });

  test('preserves existing error code', async () => {
    const filter = () => { const e = new Error('existing'); e.code = 'EXISTING'; throw e; };
    const wrapped = wrapAsyncFilter(filter, 'myFilter');
    try { await wrapped(); } catch (e) {
      expect(e.code).toBe('EXISTING');
    }
  });

  test('preserves this context', async () => {
    const filter = function(x) { return this.multiplier * x; };
    const wrapped = wrapAsyncFilter(filter, 'double');
    const ctx = { multiplier: 3 };
    expect(await wrapped.call(ctx, 4)).toBe(12);
  });

  test('resolves promise args before calling', async () => {
    const filter = (a, b) => a + b;
    const wrapped = wrapAsyncFilter(filter, 'add');
    const result = await wrapped(Promise.resolve(3), Promise.resolve(4));
    expect(result).toBe(7);
  });

  test('resolves async filter return value', async () => {
    const filter = async (x) => x * 3;
    const wrapped = wrapAsyncFilter(filter, 'triple');
    expect(await wrapped(5)).toBe(15);
  });

  test('handles mixed sync filter with promise args', async () => {
    const filter = (a, b) => a + b;
    const wrapped = wrapAsyncFilter(filter, 'add');
    const result = await wrapped(Promise.resolve(3), 4);
    expect(result).toBe(7);
  });
});
