import { describe, test, expect } from 'bun:test';
import { getSnippet, extractLineFromSnippet, splitSnippetLines } from './snippet.js';

describe('getSnippet', () => {
  test('returns null for non-array source', () => {
    expect(getSnippet(null, 1)).toBeNull();
    expect(getSnippet('string', 1)).toBeNull();
  });

  test('returns formatted snippet with context around centerLine', () => {
    const lines = ['a', 'b', 'c', 'd', 'e'];
    const result = getSnippet(lines, 3, 1);
    expect(result).toContain('>>> 3: c');
    expect(result).toContain('   2: b');
    expect(result).toContain('   4: d');
  });

  test('marks error line with >>> prefix', () => {
    const lines = ['one', 'two', 'three'];
    const result = getSnippet(lines, 2);
    expect(result).toContain('>>> 2: two');
  });

  test('handles centerLine at start', () => {
    const result = getSnippet(['a', 'b', 'c'], 1, 2);
    expect(result).toContain('>>> 1: a');
    expect(result).toContain('   2: b');
  });

  test('handles centerLine at end', () => {
    const result = getSnippet(['a', 'b', 'c'], 3, 2);
    expect(result).toContain('>>> 3: c');
    expect(result).toContain('   2: b');
  });

  test('uses space for falsy lines', () => {
    const result = getSnippet(['a', '', 'c'], 2);
    expect(result).toContain('>>> 2:  ');
  });
});

describe('extractLineFromSnippet', () => {
  test('extracts line number from snippet', () => {
    const snippet = '   1: a\n>>> 2: b\n   3: c';
    expect(extractLineFromSnippet(snippet)).toBe(2);
  });

  test('returns null for empty', () => {
    expect(extractLineFromSnippet(null)).toBeNull();
    expect(extractLineFromSnippet('')).toBeNull();
  });
});

describe('splitSnippetLines', () => {
  test('splits snippet into trimmed lines', () => {
    expect(splitSnippetLines('  a\n  b\n  c')).toEqual(['a', 'b', 'c']);
  });

  test('returns empty array for empty', () => {
    expect(splitSnippetLines(null)).toEqual([]);
  });
});
