import { describe, test, expect } from 'bun:test';
import { abs, round } from './math.ts';

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

describe('round', () => {
  test('rounds to integer by default', () => {
    expect(round(3.7)).toBe(4);
    expect(round(3.3)).toBe(3);
  });
  test('respects precision', () => {
    // Deliberately not a PI-like value: what is under test is rounding at a
    // given precision, and the digits only need to force a round-up at 4dp.
    expect(round(1.234_56, 2)).toBe(1.23);
    expect(round(1.234_56, 4)).toBe(1.2346);
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
