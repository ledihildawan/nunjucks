import { describe, test, expect } from 'bun:test';
import { stripMarkdown } from './markdown.ts';

describe('stripMarkdown', () => {
  test('strips a single bold segment', () => {
    expect(stripMarkdown('**bold**')).toBe('bold');
  });

  test('strips a single code segment', () => {
    expect(stripMarkdown('`code`')).toBe('code');
  });

  test('strips every bold segment in a string with multiple bold marks (replaceAll regression)', () => {
    expect(stripMarkdown('**a** and **b** plus **c**')).toBe('a and b plus c');
  });

  test('strips every code segment in a string with multiple code spans (replaceAll regression)', () => {
    expect(stripMarkdown('use `foo` then `bar` then `baz`')).toBe('use foo then bar then baz');
  });

  test('strips mixed bold and code segments together', () => {
    expect(stripMarkdown('**bold** and `code` and **more**')).toBe('bold and code and more');
  });

  test('leaves plain text unchanged', () => {
    expect(stripMarkdown('plain text only')).toBe('plain text only');
  });

  test('returns an empty string unchanged', () => {
    expect(stripMarkdown('')).toBe('');
  });
});
