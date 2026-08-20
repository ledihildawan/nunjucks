import { describe, expect, test } from 'bun:test';
import { collectBackward, collectForward, normalizeIndex } from './slice.ts';

describe('normalizeIndex', () => {
  test('clamps explicit indices to the given length', () => {
    expect(normalizeIndex({ index: 2, length: 3, defaultValue: 0, step: 1 })).toBe(2);
    expect(normalizeIndex({ index: 99, length: 3, defaultValue: 0, step: 1 })).toBe(3);
    expect(normalizeIndex({ index: -2, length: 3, defaultValue: 0, step: 1 })).toBe(1);
    expect(normalizeIndex({ index: 0, length: 3, defaultValue: 0, step: 1 })).toBe(0);
  });

  test('uses the default for nullish indices', () => {
    expect(normalizeIndex({ index: null, length: 3, defaultValue: 0, step: 1 })).toBe(0);
    expect(normalizeIndex({ index: null, length: 3, defaultValue: -1, step: -1 })).toBe(-1);
  });

  test('with a negative step and defaultVal 0 resolves to the last index', () => {
    expect(normalizeIndex({ index: null, length: 4, defaultValue: 0, step: -1 })).toBe(3);
  });
});

describe('collectForward', () => {
  test('collects every step-sized element up to (not including) stop', () => {
    expect(collectForward({ source: [0, 1, 2, 3, 4, 5], start: 0, stop: 6, step: 2 })).toEqual([
      0, 2, 4,
    ]);
  });

  test('starts at the given start index', () => {
    expect(collectForward({ source: [0, 1, 2, 3, 4, 5], start: 1, stop: 5, step: 2 })).toEqual([
      1, 3,
    ]);
  });

  test('returns an empty array when start is already past stop', () => {
    expect(collectForward({ source: [0, 1, 2], start: 3, stop: 2, step: 1 })).toEqual([]);
  });
});

describe('collectBackward', () => {
  test('collects backwards while the index stays above stop', () => {
    expect(collectBackward({ source: [0, 1, 2, 3], start: 3, stop: 0, step: -1 })).toEqual([
      3, 2, 1,
    ]);
  });

  test('stops at (does not include) the stop index', () => {
    expect(collectBackward({ source: [0, 1, 2, 3], start: 3, stop: 1, step: -1 })).toEqual([3, 2]);
  });

  test('returns an empty array when starting at or below stop', () => {
    expect(collectBackward({ source: [0, 1, 2], start: 1, stop: 1, step: -1 })).toEqual([]);
  });
});
