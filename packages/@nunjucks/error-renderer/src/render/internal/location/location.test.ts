import { describe, test, expect } from 'bun:test';
import { formatLocationAnnotation, toDisplayLocation } from './location.ts';

describe('toDisplayLocation', () => {
  describe('lineBase zero (default)', () => {
    test('normalizes a zero-based line and column to one-based display values', () => {
      expect(toDisplayLocation({ lineno: 0, colno: 0, lineBase: 'zero' })).toEqual({ line: 1, col: 1 });
    });

    test('adds one to arbitrary zero-based coordinates', () => {
      expect(toDisplayLocation({ lineno: 4, colno: 2, lineBase: 'zero' })).toEqual({ line: 5, col: 3 });
    });

    test('treats a null lineno as line one', () => {
      expect(toDisplayLocation({ lineno: null, colno: 5, lineBase: 'zero' })).toEqual({ line: 1, col: 6 });
    });

    test('treats a null colno as column one', () => {
      expect(toDisplayLocation({ lineno: 3, colno: null, lineBase: 'zero' })).toEqual({ line: 4, col: 1 });
    });

    test('defaults to zero base when lineBase is omitted', () => {
      expect(toDisplayLocation({ lineno: 2, colno: 1 })).toEqual({ line: 3, col: 2 });
    });

    test('defaults to zero base when lineBase is null', () => {
      expect(toDisplayLocation({ lineno: 2, colno: 1, lineBase: null })).toEqual({ line: 3, col: 2 });
    });
  });

  describe('lineBase one', () => {
    test('passes one-based coordinates through unchanged', () => {
      expect(toDisplayLocation({ lineno: 5, colno: 3, lineBase: 'one' })).toEqual({ line: 5, col: 3 });
    });

    test('clamps a zero lineno and colno to one', () => {
      expect(toDisplayLocation({ lineno: 0, colno: 0, lineBase: 'one' })).toEqual({ line: 1, col: 1 });
    });

    test('clamps a null lineno and colno to one', () => {
      expect(toDisplayLocation({ lineno: null, colno: null, lineBase: 'one' })).toEqual({ line: 1, col: 1 });
    });

    test('clamps an undefined lineno and colno to one', () => {
      expect(toDisplayLocation({ lineno: undefined, colno: undefined, lineBase: 'one' })).toEqual({
        line: 1,
        col: 1,
      });
    });
  });
});

describe('formatLocationAnnotation', () => {
  test('returns an empty string when lineno is undefined', () => {
    expect(formatLocationAnnotation({ colno: 3, lineBase: 'zero' })).toBe('');
  });

  test('returns an empty string when lineno is null', () => {
    expect(formatLocationAnnotation({ lineno: null, colno: 3, lineBase: 'zero' })).toBe('');
  });

  test('renders line and column under lineBase zero', () => {
    expect(formatLocationAnnotation({ lineno: 4, colno: 2, lineBase: 'zero' })).toBe('[Line 5, Column 3]');
  });

  test('renders line and column under lineBase one', () => {
    expect(formatLocationAnnotation({ lineno: 4, colno: 2, lineBase: 'one' })).toBe('[Line 4, Column 2]');
  });

  test('renders only the line when colno is null', () => {
    expect(formatLocationAnnotation({ lineno: 4, colno: null, lineBase: 'zero' })).toBe('[Line 5]');
  });

  test('renders only the line when colno is undefined', () => {
    expect(formatLocationAnnotation({ lineno: 4, lineBase: 'zero' })).toBe('[Line 5]');
  });

  test('defaults to lineBase zero when lineBase is omitted', () => {
    expect(formatLocationAnnotation({ lineno: 0, colno: 0 })).toBe('[Line 1, Column 1]');
  });

  test('clamps a zero lineno and colno to one under lineBase one', () => {
    expect(formatLocationAnnotation({ lineno: 0, colno: 0, lineBase: 'one' })).toBe('[Line 1, Column 1]');
  });
});
