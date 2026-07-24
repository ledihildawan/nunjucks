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
    expect(round(3.141_59, 2)).toBe(3.14);
    expect(round(3.141_59, 4)).toBe(3.1416);
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
