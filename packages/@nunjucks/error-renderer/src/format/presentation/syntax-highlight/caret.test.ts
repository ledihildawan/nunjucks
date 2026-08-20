import { describe, expect, test } from 'bun:test';
import { calculateCaretPosition } from './caret.ts';

describe('calculateCaretPosition', () => {
  test('returns null for displayCol <= 0', () => {
    expect(calculateCaretPosition('hello', 0)).toBeNull();
  });

  test('returns null for empty line', () => {
    expect(calculateCaretPosition('', 1)).toBeNull();
  });

  test('finds word under cursor', () => {
    const r = calculateCaretPosition('hello world', 1);
    expect(r).not.toBeNull();
    expect(r?.highlightWord).toBe('hello');
  });

  test('handles whitespace by searching left', () => {
    const r = calculateCaretPosition('hello  ', 7);
    expect(r?.highlightWord).toBe('hello');
  });

  test('non-word char produces single caret', () => {
    const r = calculateCaretPosition('a + b', 3);
    expect(r).not.toBeNull();
    expect(r?.carets.length).toBeGreaterThanOrEqual(1);
  });

  // WHY: regression pin — the word scans used to recurse per character and
  // overflowed the stack on pathological single-line sources.
  test('survives a pathological single-line word without overflowing the stack', () => {
    const longWord = 'a'.repeat(100_000);
    const r = calculateCaretPosition(longWord, 99_999);
    expect(r?.highlightWord).toBe(longWord);
    expect(r?.carets).toHaveLength(100_000);
  });
});
