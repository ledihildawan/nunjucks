import { describe, test, expect } from 'bun:test';
import { abs, round } from './math.ts';

describe('filters/math', () => {
  describe('abs', () => {
    test('returns the absolute value of a positive number', () => {
      expect(abs(5)).toBe(5);
    });

    test('returns the absolute value of a negative number', () => {
      expect(abs(-5)).toBe(5);
      expect(abs(-3.14)).toBe(3.14);
    });

    test('returns zero for zero', () => {
      expect(abs(0)).toBe(0);
    });

    test('throws when given a non-number', () => {
      expect(() => abs('5')).toThrow();
      expect(() => abs(null)).toThrow();
      expect(() => abs(undefined)).toThrow();
    });
  });

  describe('round', () => {
    test('rounds to the nearest integer by default', () => {
      expect(round(1.4)).toBe(1);
      expect(round(1.5)).toBe(2);
      expect(round(1.6)).toBe(2);
      expect(round(-1.4)).toBe(-1);
      expect(round(-1.5)).toBe(-1);
    });

    test('rounds to the requested decimal precision', () => {
      expect(round(1.234, 2)).toBe(1.23);
      expect(round(1.235, 2)).toBe(1.24);
      expect(round(1.2345, 3)).toBe(1.235);
    });

    test('uses Math.ceil when method is "ceil"', () => {
      expect(round(1.1, 0, 'ceil')).toBe(2);
      expect(round(1.234, 2, 'ceil')).toBe(1.24);
    });

    test('uses Math.floor when method is "floor"', () => {
      expect(round(1.9, 0, 'floor')).toBe(1);
      expect(round(1.239, 2, 'floor')).toBe(1.23);
    });

    test('uses Math.round when method is "round" (or omitted)', () => {
      expect(round(1.5, 0, 'round')).toBe(2);
      expect(round(2.5, 0, 'round')).toBe(3);
    });

    test('treats omitted precision as zero', () => {
      expect(round(3.7)).toBe(4);
    });

    test('throws when given a non-number', () => {
      expect(() => round('1.5')).toThrow();
      expect(() => round(null)).toThrow();
    });
  });
});