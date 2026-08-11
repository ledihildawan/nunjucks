import { describe, test, expect } from 'bun:test';
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
});
