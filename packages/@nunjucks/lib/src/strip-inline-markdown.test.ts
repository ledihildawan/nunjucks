import { describe, expect, test } from 'bun:test';
import { stripInlineMarkdown } from './strip-inline-markdown.ts';

describe('stripInlineMarkdown', () => {
  test('removes bold markers', () => {
    expect(stripInlineMarkdown('a **bold** paragraph')).toBe('a bold paragraph');
  });

  test('removes inline code backticks', () => {
    expect(stripInlineMarkdown('run `bun test`')).toBe('run bun test');
  });

  test('leaves plain text untouched', () => {
    expect(stripInlineMarkdown('no markers here')).toBe('no markers here');
  });

  test('strips a single bold segment', () => {
    expect(stripInlineMarkdown('**bold**')).toBe('bold');
  });

  test('strips a single code segment', () => {
    expect(stripInlineMarkdown('`code`')).toBe('code');
  });

  test('strips every bold segment in a string with multiple bold marks (replaceAll regression)', () => {
    expect(stripInlineMarkdown('**a** and **b** plus **c**')).toBe('a and b plus c');
  });

  test('strips every code segment in a string with multiple code spans (replaceAll regression)', () => {
    expect(stripInlineMarkdown('use `foo` then `bar` then `baz`')).toBe(
      'use foo then bar then baz'
    );
  });

  test('strips mixed bold and code segments together', () => {
    expect(stripInlineMarkdown('**bold** and `code` and **more**')).toBe('bold and code and more');
  });

  test('returns an empty string unchanged', () => {
    expect(stripInlineMarkdown('')).toBe('');
  });
});
