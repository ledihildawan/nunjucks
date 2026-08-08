import { describe, test, expect } from 'bun:test';
import { escapeRegex } from './escape-regex.ts';

describe('escapeRegex', () => {
  test('escapes regex metacharacters', () => {
    expect(escapeRegex('a.b*c')).toBe('a\\.b\\*c');
  });

  test('escapes brackets and parentheses', () => {
    expect(escapeRegex('[group](alt)')).toBe('\\[group\\]\\(alt\\)');
  });

  test('escapes backslashes and braces', () => {
    expect(escapeRegex('\\d{2}')).toBe('\\\\d\\{2\\}');
  });

  test('leaves plain text untouched', () => {
    expect(escapeRegex('plain_text-1')).toBe('plain_text-1');
  });

  test('produces a pattern that matches the original literally', () => {
    const raw = 'price: $5.00 (each)';
    const pattern = new RegExp(escapeRegex(raw), 'u');
    expect(raw.match(pattern)?.[0]).toBe(raw);
  });
});
