import { describe, test, expect } from 'bun:test';
import { containsNullByte, isWithinBase } from './path-policy.ts';

describe('containsNullByte', () => {
  test('detects NUL characters anywhere in the name', () => {
    expect(containsNullByte('..\0.txt')).toBe(true);
    expect(containsNullByte('../\0')).toBe(true);
  });

  test('returns false for ordinary names', () => {
    expect(containsNullByte('file.txt')).toBe(false);
    expect(containsNullByte('')).toBe(false);
  });
});

describe('isWithinBase', () => {
  test('accepts files inside the base directory', () => {
    expect(isWithinBase('/var/www', '/var/www/app/index.html')).toBe(true);
  });

  test('accepts the base directory itself', () => {
    expect(isWithinBase('/var/www', '/var/www')).toBe(true);
  });

  test('rejects sibling and parent escapes', () => {
    expect(isWithinBase('/var/www', '/var/other')).toBe(false);
    expect(isWithinBase('/var/www/app', '/var/www')).toBe(false);
  });

  test('rejects escapes that resolve to an absolute path', () => {
    expect(isWithinBase('/var/www', '/etc/passwd')).toBe(false);
  });
});