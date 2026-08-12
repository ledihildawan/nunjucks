import { describe, test, expect } from 'bun:test';
import { stripMarkdown } from './strip-markdown.ts';

describe('stripMarkdown', () => {
  test('removes bold markers', () => {
    expect(stripMarkdown('a **bold** paragraph')).toBe('a bold paragraph');
  });

  test('removes inline code backticks', () => {
    expect(stripMarkdown('run `bun test`')).toBe('run bun test');
  });

  test('leaves plain text untouched', () => {
    expect(stripMarkdown('no markers here')).toBe('no markers here');
  });
});