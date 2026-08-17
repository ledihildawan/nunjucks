import { describe, expect, test } from 'bun:test';
import { toDisplayLocation } from './location.ts';

describe('toDisplayLocation', () => {
  describe('lineBase zero (default)', () => {
    test('normalizes a zero-based line and column to one-based display values', () => {
      expect(toDisplayLocation({ lineno: 0, colno: 0, lineBase: 'zero' })).toEqual({
        line: 1,
        col: 1,
      });
    });

    test('adds one to arbitrary zero-based coordinates', () => {
      expect(toDisplayLocation({ lineno: 4, colno: 2, lineBase: 'zero' })).toEqual({
        line: 5,
        col: 3,
      });
    });

    test('treats a null lineno as line one', () => {
      expect(toDisplayLocation({ lineno: null, colno: 5, lineBase: 'zero' })).toEqual({
        line: 1,
        col: 6,
      });
    });

    test('treats a null colno as column one', () => {
      expect(toDisplayLocation({ lineno: 3, colno: null, lineBase: 'zero' })).toEqual({
        line: 4,
        col: 1,
      });
    });

    test('defaults to zero base when lineBase is omitted', () => {
      expect(toDisplayLocation({ lineno: 2, colno: 1 })).toEqual({ line: 3, col: 2 });
    });

    test('defaults to zero base when lineBase is null', () => {
      expect(toDisplayLocation({ lineno: 2, colno: 1, lineBase: null })).toEqual({
        line: 3,
        col: 2,
      });
    });
  });

  describe('lineBase one', () => {
    test('passes one-based coordinates through unchanged', () => {
      expect(toDisplayLocation({ lineno: 5, colno: 3, lineBase: 'one' })).toEqual({
        line: 5,
        col: 3,
      });
    });

    test('clamps a zero lineno and colno to one', () => {
      expect(toDisplayLocation({ lineno: 0, colno: 0, lineBase: 'one' })).toEqual({
        line: 1,
        col: 1,
      });
    });

    test('clamps a null lineno and colno to one', () => {
      expect(toDisplayLocation({ lineno: null, colno: null, lineBase: 'one' })).toEqual({
        line: 1,
        col: 1,
      });
    });

    test('clamps an undefined lineno and colno to one', () => {
      expect(toDisplayLocation({ lineno: undefined, colno: undefined, lineBase: 'one' })).toEqual({
        line: 1,
        col: 1,
      });
    });
  });
});
