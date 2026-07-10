import { describe, test, expect } from 'bun:test';
import { abs, isNaN, round, float, int } from './math.js';

describe('abs', () => {
  test('returns Math.abs', () => {
    expect(abs).toBe(Math.abs);
    expect(abs(-5)).toBe(5);
    expect(abs(3)).toBe(3);
  });
});

describe('isNaN', () => {
  test('returns true for NaN', () => {
    expect(isNaN(NaN)).toBe(true);
  });

  test('returns false for numbers', () => {
    expect(isNaN(42)).toBe(false);
    expect(isNaN(0)).toBe(false);
  });
});

describe('round', () => {
  test('rounds to nearest integer by default', () => {
    expect(round(3.7)).toBe(4);
    expect(round(3.2)).toBe(3);
  });

  test('rounds with precision', () => {
    expect(round(3.14159, 2)).toBe(3.14);
    expect(round(3.14159, 4)).toBe(3.1416);
  });

  test('rounds with ceil method', () => {
    expect(round(3.1, 0, 'ceil')).toBe(4);
    expect(round(3.9, 0, 'ceil')).toBe(4);
  });

  test('rounds with floor method', () => {
    expect(round(3.9, 0, 'floor')).toBe(3);
    expect(round(3.1, 0, 'floor')).toBe(3);
  });

  test('defaults precision to 0', () => {
    expect(round(4.567)).toBe(5);
  });
});

describe('float', () => {
  test('parses float from string', () => {
    expect(float('3.14')).toBe(3.14);
  });

  test('returns default for non-numeric', () => {
    expect(float('abc', 0)).toBe(0);
    expect(float('abc')).toBeUndefined();
  });

  test('handles integer strings', () => {
    expect(float('42')).toBe(42);
  });
});

describe('int', () => {
  test('parses integer from string', () => {
    expect(int('42')).toBe(42);
  });

  test('parses with base', () => {
    expect(int('ff', null, 16)).toBe(255);
    expect(int('10', null, 8)).toBe(8);
  });

  test('returns default for non-numeric', () => {
    expect(int('abc', 0)).toBe(0);
  });

  test('returns undefined default when omitted', () => {
    expect(int('abc')).toBeUndefined();
  });
});
