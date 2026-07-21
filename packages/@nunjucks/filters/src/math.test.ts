import { describe, test, expect } from 'bun:test';
import { abs, isNaN, round, float, intFilter } from './math.ts';

describe('abs', () => {
  test('positive number unchanged', () => {
    expect(abs(5)).toBe(5);
  });
  test('negative number becomes positive', () => {
    expect(abs(-5)).toBe(5);
  });
  test('zero stays zero', () => {
    expect(abs(0)).toBe(0);
  });
});

describe('isNaN', () => {
  test('NaN returns true', () => {
    expect(isNaN(NaN)).toBe(true);
  });
  test('number returns false', () => {
    expect(isNaN(42)).toBe(false);
  });
});

describe('round', () => {
  test('rounds to integer by default', () => {
    expect(round(3.7)).toBe(4);
    expect(round(3.3)).toBe(3);
  });
  test('respects precision', () => {
    expect(round(3.14159, 2)).toBe(3.14);
    expect(round(3.14159, 4)).toBe(3.1416);
  });
  test('supports ceil method', () => {
    expect(round(3.1, 0, 'ceil')).toBe(4);
  });
  test('supports floor method', () => {
    expect(round(3.9, 0, 'floor')).toBe(3);
  });
  test('negative numbers', () => {
    expect(round(-3.5)).toBe(-3);
  });
});

describe('float', () => {
  test('parses numeric string', () => {
    expect(float('3.14')).toBe(3.14);
  });
  test('returns default for invalid', () => {
    expect(float('abc', 0)).toBe(0);
  });
  test('parses integer string', () => {
    expect(float('42')).toBe(42);
  });
});

describe('intFilter', () => {
  test('parses numeric string', () => {
    expect(intFilter('42')).toBe(42);
  });
  test('supports base parameter', () => {
    expect(intFilter('ff', 0, 16)).toBe(255);
  });
  test('returns default for invalid', () => {
    expect(intFilter('abc', -1)).toBe(-1);
  });
});
