import { describe, expect, test } from 'bun:test';
import { isDigit } from './is-digit.ts';

describe('isDigit', () => {
  test('accepts ASCII digits', () => {
    expect(isDigit('0')).toBe(true);
    expect(isDigit('5')).toBe(true);
    expect(isDigit('9')).toBe(true);
  });

  test('rejects non-digit characters', () => {
    expect(isDigit('a')).toBe(false);
    expect(isDigit('')).toBe(false);
    expect(isDigit('.')).toBe(false);
  });

  test('rejects the characters adjacent to the digit range', () => {
    expect(isDigit('/')).toBe(false);
    expect(isDigit(':')).toBe(false);
  });
});
