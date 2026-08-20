import { describe, expect, test } from 'bun:test';
import { titleCase } from './string-case.ts';

describe('titleCase', () => {
  test('upper-cases the first character only', () => {
    expect(titleCase('hello world')).toBe('Hello world');
  });

  test('leaves already-capitalized words untouched', () => {
    expect(titleCase('Hello')).toBe('Hello');
  });

  test('handles empty strings', () => {
    expect(titleCase('')).toBe('');
  });
});
