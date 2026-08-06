import { describe, test, expect } from 'bun:test';
import { awaitValue } from './index.ts';

describe('awaitValue', () => {
  test('returns non-promise values unchanged', () => {
    expect(awaitValue(42)).toBe(42);
    expect(awaitValue('hi')).toBe('hi');
    expect(awaitValue(null)).toBeNull();
    expect(awaitValue(undefined)).toBeUndefined();
  });

  test('resolves a promise to its value', async () => {
    expect(await awaitValue(Promise.resolve(99))).toBe(99);
  });
});
