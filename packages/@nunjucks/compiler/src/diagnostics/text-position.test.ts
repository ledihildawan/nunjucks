import { describe, expect, test } from 'bun:test';
import { findAllOccurrences, lineDistance, positionAtOffset } from './text-position.ts';

describe('lineDistance', () => {
  test('null preferredLine collapses every candidate to distance 0 (first wins)', () => {
    expect(lineDistance(7, null)).toBe(0);
  });

  test('undefined preferredLine behaves like null', () => {
    expect(lineDistance(7, undefined)).toBe(0);
  });

  test('absolute distance in both directions', () => {
    expect(lineDistance(2, 5)).toBe(3);
    expect(lineDistance(9, 5)).toBe(4);
  });
});

describe('positionAtOffset', () => {
  test('offset 0 is line 0, col 0', () => {
    expect(positionAtOffset('ab\ncd', 0)).toEqual({ lineOffset: 0, col: 0 });
  });

  test('offset on a line boundary starts the next line at col 0', () => {
    expect(positionAtOffset('ab\ncd', 3)).toEqual({ lineOffset: 1, col: 0 });
  });

  test('counts columns within a line', () => {
    expect(positionAtOffset('ab\ncdef', 5)).toEqual({ lineOffset: 1, col: 2 });
  });

  test('tracks multiple line breaks', () => {
    expect(positionAtOffset('a\nb\nc', 4)).toEqual({ lineOffset: 2, col: 0 });
  });

  test('CRLF: the carriage return stays in-line as a column (documented caveat)', () => {
    // WHY: the offset math counts characters and splits on \n only, so \r occupies a
    // column at the end of its line — pinned as the known contract.
    expect(positionAtOffset('ab\r\ncd', 2)).toEqual({ lineOffset: 0, col: 2 });
    expect(positionAtOffset('ab\r\ncd', 3)).toEqual({ lineOffset: 0, col: 3 });
    expect(positionAtOffset('ab\r\ncd', 4)).toEqual({ lineOffset: 1, col: 0 });
  });
});

describe('findAllOccurrences', () => {
  test('regex-special candidates match literally, never as patterns', () => {
    expect(findAllOccurrences('value a.b*c + aXbYc', 'a.b*c')).toEqual([6]);
  });

  test('adjacent repeats are non-overlapping', () => {
    expect(findAllOccurrences('aaaa', 'aa')).toEqual([0, 2]);
  });

  test('returns an empty array when absent', () => {
    expect(findAllOccurrences('xyz', 'q')).toEqual([]);
  });
});
