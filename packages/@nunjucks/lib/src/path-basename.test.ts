import { describe, expect, test } from 'bun:test';
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

  test('returns unknown for the empty final segment after a trailing separator', () => {
    expect(basename('a/b/')).toBe('unknown');
    expect(basename('foo/')).toBe('unknown');
    expect(basename('/')).toBe('unknown');
    expect(basename('dir\\')).toBe('unknown');
  });
});
