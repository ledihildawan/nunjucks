import { describe, test, expect } from 'bun:test';
import { basename } from './path-basename.ts';

describe('basename', () => {
  test('returns unknown for nullish or empty paths', () => {
    expect(basename(null)).toBe('unknown');
    expect(basename(undefined)).toBe('unknown');
    expect(basename('')).toBe('unknown');
  });

  test('extracts the last posix segment', () => {
    expect(basename('a/b/c.txt')).toBe('c.txt');
  });

  test('extracts the last windows segment', () => {
    expect(basename('a\\b\\c.txt')).toBe('c.txt');
  });

  test('handles mixed separators', () => {
    expect(basename('a/b\\c.txt')).toBe('c.txt');
  });

  test('returns the whole path when no separator exists', () => {
    expect(basename('file.txt')).toBe('file.txt');
  });

  test('returns extension-less names unchanged', () => {
    expect(basename('a/b/name')).toBe('name');
  });

  test('yields an empty final segment after a trailing slash', () => {
    expect(basename('a/b/')).toBe('');
    expect(basename('/')).toBe('');
  });
});
