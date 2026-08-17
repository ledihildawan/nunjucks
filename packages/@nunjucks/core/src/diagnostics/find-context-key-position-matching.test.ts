import { describe, expect, test } from 'bun:test';
import { findBestMatch, findBetterMatch } from './find-context-key-position-matching.ts';

describe('findBestMatch', () => {
  test('word boundary: key "eval" does not match inside "retrieval"', () => {
    const lines = ['const retrieval = 1;'];
    expect(findBestMatch({ lines, keyName: 'eval', searchLine: 0, searchRadius: 5 })).toBeNull();
  });

  test('word boundary: a prop-key pattern still matches name-at-colon', () => {
    const lines = ['const ctx = { global: process };'];
    expect(findBestMatch({ lines, keyName: 'global:', searchLine: 0, searchRadius: 5 })).toEqual({
      line: 1,
      col: 15,
    });
  });

  test('occurrence columns are 1-based', () => {
    const lines = ['xx target yy'];
    expect(findBestMatch({ lines, keyName: 'target', searchLine: 0, searchRadius: 5 })).toEqual({
      line: 1,
      col: 4,
    });
  });

  test('prefers the nearer line when distances differ', () => {
    const lines = ['far', '', 'near', 'call'];
    expect(findBestMatch({ lines, keyName: 'near', searchLine: 3, searchRadius: 5 })).toEqual({
      line: 3,
      col: 1,
    });
  });

  test('radius clamp: a match beyond the ±radius window is excluded', () => {
    const lines = ['target', '', '', '', '', '', '', 'call'];
    expect(findBestMatch({ lines, keyName: 'target', searchLine: 7, searchRadius: 5 })).toBeNull();
  });

  test('window clamps at the file start for a searchLine near zero', () => {
    const lines = ['target', '', '', '', '', 'call'];
    expect(findBestMatch({ lines, keyName: 'target', searchLine: 5, searchRadius: 5 })).toEqual({
      line: 1,
      col: 1,
    });
  });
});

describe('findBetterMatch tie-break', () => {
  // WHY: searchLine 3 and line-1 candidates → candidateLine 0 → distance 3 for both.
  const searchLine = 3;

  test('same distance: the earlier column wins', () => {
    const acc = { best: { line: 1, col: 20 }, bestDistance: 3 };
    expect(findBetterMatch(acc, { line: 1, col: 5 }, searchLine).best).toEqual({
      line: 1,
      col: 5,
    });
  });

  test('same distance: a later column does not steal the best', () => {
    const acc = { best: { line: 1, col: 20 }, bestDistance: 3 };
    expect(findBetterMatch(acc, { line: 1, col: 30 }, searchLine).best).toEqual({
      line: 1,
      col: 20,
    });
  });

  test('a nearer line always wins regardless of column', () => {
    const acc = { best: { line: 1, col: 1 }, bestDistance: 3 };
    expect(findBetterMatch(acc, { line: 2, col: 90 }, searchLine).best).toEqual({
      line: 2,
      col: 90,
    });
  });
});
