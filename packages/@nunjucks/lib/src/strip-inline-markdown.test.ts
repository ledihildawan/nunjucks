import { describe, test, expect } from 'bun:test';
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
});
