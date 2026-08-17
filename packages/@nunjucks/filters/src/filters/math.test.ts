import { describe, expect, test } from 'bun:test';
import { getOrElse, isOk } from '@nunjucks/lib';
import { abs, round } from './math.ts';

describe('filters/math', () => {
  describe('abs', () => {
    test('returns the absolute value of a positive number', () => {
      expect(getOrElse(abs(5), null)).toBe(5);
    });

    test('returns the absolute value of a negative number', () => {
      expect(getOrElse(abs(-5), null)).toBe(5);
      expect(getOrElse(abs(-3.14), null)).toBe(3.14);
    });

    test('returns zero for zero', () => {
      expect(getOrElse(abs(0), null)).toBe(0);
    });

    test('returns error when given a non-number', () => {
      const stringInputResult = abs('5');
      expect(isOk(stringInputResult)).toBe(false);
      const nullInputResult = abs(null);
      expect(isOk(nullInputResult)).toBe(false);
      const undefinedInputResult = abs(undefined);
      expect(isOk(undefinedInputResult)).toBe(false);
    });
  });

  describe('round', () => {
    test('rounds to the nearest integer by default', () => {
      expect(getOrElse(round(1.4), null)).toBe(1);
      expect(getOrElse(round(1.5), null)).toBe(2);
      expect(getOrElse(round(1.6), null)).toBe(2);
      expect(getOrElse(round(-1.4), null)).toBe(-1);
      expect(getOrElse(round(-1.5), null)).toBe(-1);
    });

    test('rounds to the requested decimal precision', () => {
      expect(getOrElse(round(1.234, 2), null)).toBe(1.23);
      expect(getOrElse(round(1.235, 2), null)).toBe(1.24);
      expect(getOrElse(round(1.2345, 3), null)).toBe(1.235);
    });

    test('uses Math.ceil when method is "ceil"', () => {
      expect(getOrElse(round(1.1, 0, 'ceil'), null)).toBe(2);
      expect(getOrElse(round(1.234, 2, 'ceil'), null)).toBe(1.24);
    });

    test('uses Math.floor when method is "floor"', () => {
      expect(getOrElse(round(1.9, 0, 'floor'), null)).toBe(1);
      expect(getOrElse(round(1.239, 2, 'floor'), null)).toBe(1.23);
    });

    test('uses Math.round when method is "round" (or omitted)', () => {
      expect(getOrElse(round(1.5, 0, 'round'), null)).toBe(2);
      expect(getOrElse(round(2.5, 0, 'round'), null)).toBe(3);
    });

    test('returns an error for an unknown method string', () => {
      const result = round(1.1, 0, 'bogus');
      expect(isOk(result)).toBe(false);
    });

    test('binds compiler kwargs envelopes (positional names fold into options)', () => {
      expect(getOrElse(round(1.234, 2), null)).toBe(1.23);
      expect(getOrElse(round(1.1, 0, 'ceil'), null)).toBe(2);
      const envelope = { value: 1.234, precision: 2, keywords: true };
      expect(getOrElse(round(envelope), null)).toBe(1.23);
    });

    test('treats omitted precision as zero', () => {
      expect(getOrElse(round(3.7), null)).toBe(4);
    });

    test('returns error when given a non-number', () => {
      const stringInputResult = round('1.5');
      expect(isOk(stringInputResult)).toBe(false);
      const nullInputResult = round(null);
      expect(isOk(nullInputResult)).toBe(false);
    });
  });
});
