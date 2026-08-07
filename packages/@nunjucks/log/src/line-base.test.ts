import { describe, test, expect } from 'bun:test';
import { normalizeLineBase } from './line-base.ts';

describe('normalizeLineBase', () => {
  test('one → one', () => {
    expect(normalizeLineBase('one')).toBe('one');
  });
  test('zero → zero', () => {
    expect(normalizeLineBase('zero')).toBe('zero');
  });
  test('undefined → zero', () => {
    expect(normalizeLineBase(undefined)).toBe('zero');
  });
  test('null → zero', () => {
    expect(normalizeLineBase(null)).toBe('zero');
  });
  test('other string → zero', () => {
    expect(normalizeLineBase('other' as never)).toBe('zero');
  });
});
