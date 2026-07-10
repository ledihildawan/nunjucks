import { describe, test, expect } from 'bun:test';
import { asyncEach, asyncAll } from './async.js';

describe('asyncEach', () => {
  test('iterates over array with dimen 1', async () => {
    const results = [];
    await asyncEach([10, 20, 30], 1, async (item, i, len) => {
      results.push({ item, i, len });
    });
    expect(results).toEqual([
      { item: 10, i: 0, len: 3 },
      { item: 20, i: 1, len: 3 },
      { item: 30, i: 2, len: 3 },
    ]);
  });

  test('iterates over array with dimen 2', async () => {
    const results = [];
    await asyncEach([[1, 'a'], [2, 'b']], 2, async (k, v, i, len) => {
      results.push({ k, v, i, len });
    });
    expect(results).toEqual([
      { k: 1, v: 'a', i: 0, len: 2 },
      { k: 2, v: 'b', i: 1, len: 2 },
    ]);
  });

  test('iterates over array with dimen 3', async () => {
    const results = [];
    await asyncEach([[1, 2, 3], [4, 5, 6]], 3, async (a, b, c, i, len) => {
      results.push({ a, b, c, i, len });
    });
    expect(results).toEqual([
      { a: 1, b: 2, c: 3, i: 0, len: 2 },
      { a: 4, b: 5, c: 6, i: 1, len: 2 },
    ]);
  });

  test('iterates over object', async () => {
    const results = [];
    await asyncEach({ a: 1, b: 2 }, 1, async (k, v, i, len) => {
      results.push({ k, v, i, len });
    });
    expect(results).toEqual([
      { k: 'a', v: 1, i: 0, len: 2 },
      { k: 'b', v: 2, i: 1, len: 2 },
    ]);
  });

  test('handles empty array', async () => {
    let called = false;
    await asyncEach([], 1, async () => { called = true; });
    expect(called).toBe(false);
  });

  test('handles null/undefined object', async () => {
    let called = false;
    await asyncEach(null, 1, async () => { called = true; });
    expect(called).toBe(false);
  });
});

describe('asyncAll', () => {
  test('collects results from array with dimen 1', async () => {
    const result = await asyncAll([1, 2, 3], 1, async (item, i, len) => {
      return String(item * 2);
    });
    expect(result).toBe('246');
  });

  test('collects results from array with dimen 2', async () => {
    const result = await asyncAll([['a', 1], ['b', 2]], 2, async (k, v, i, len) => {
      return `${k}:${v}`;
    });
    expect(result).toBe('a:1b:2');
  });

  test('returns empty string for empty array', async () => {
    const result = await asyncAll([], 1, async () => 'x');
    expect(result).toBe('');
  });

  test('collects results from object', async () => {
    const result = await asyncAll({ x: 10, y: 20 }, 1, async (k, v, i, len) => {
      return `${k}=${v}`;
    });
    expect(result).toBe('x=10y=20');
  });

  test('returns empty string for empty object', async () => {
    const result = await asyncAll({}, 1, async () => 'x');
    expect(result).toBe('');
  });

  test('handles null/undefined', async () => {
    const result = await asyncAll(null, 1, async () => 'x');
    expect(result).toBe('');
  });
});
