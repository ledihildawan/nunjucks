import { describe, test, expect } from 'bun:test';
import {
  normalizeLine, normalizeCol,
  getDisplayLine, getDisplayCol,
  getFallbackLine, getFallbackCol,
  mergeLine, mergeCol,
  createDisplayLine, createDisplayCol,
} from './line.js';

describe('normalizeLine / normalizeCol', () => {
  test('returns value as-is', () => {
    expect(normalizeLine(5)).toBe(5);
    expect(normalizeLine(null)).toBeNull();
  });

  test('returns null for undefined', () => {
    expect(normalizeLine(undefined)).toBeNull();
    expect(normalizeCol(undefined)).toBeNull();
  });
});

describe('getDisplayLine / getDisplayCol', () => {
  test('returns value as-is', () => {
    expect(getDisplayLine(5)).toBe(5);
    expect(getDisplayCol(3)).toBe(3);
  });

  test('returns null for null/undefined', () => {
    expect(getDisplayLine(null)).toBeNull();
    expect(getDisplayCol(undefined)).toBeNull();
  });
});

describe('getFallbackLine / getFallbackCol', () => {
  test('returns extracted first, then raw', () => {
    expect(getFallbackLine(10, 5)).toBe(10);
    expect(getFallbackLine(5, null)).toBe(5);
    expect(getFallbackLine(null, 5)).toBe(5);
    expect(getFallbackLine(null, null)).toBeNull();
  });
});

describe('mergeLine', () => {
  test('prefers rawLine', () => {
    expect(mergeLine(5, 10)).toBe(5);
  });

  test('falls back to extractedLine', () => {
    expect(mergeLine(null, 10)).toBe(10);
  });

  test('returns null if both null', () => {
    expect(mergeLine(null, null)).toBeNull();
  });
});

describe('mergeCol', () => {
  test('prefers rawCol', () => {
    expect(mergeCol(5, 10, 15)).toBe(5);
  });

  test('falls back to extractedCol', () => {
    expect(mergeCol(null, 10, 15)).toBe(10);
  });

  test('falls back to msgCol', () => {
    expect(mergeCol(null, null, 15)).toBe(15);
  });

  test('returns null if all null', () => {
    expect(mergeCol(null, null, null)).toBeNull();
  });
});

describe('createDisplayLine / createDisplayCol', () => {
  test('returns value for number input', () => {
    expect(createDisplayLine(5)).toBe(5);
    expect(createDisplayCol(3)).toBe(3);
  });

  test('returns ? for null/undefined', () => {
    expect(createDisplayLine(null)).toBe('?');
    expect(createDisplayCol(undefined)).toBe('?');
  });
});
