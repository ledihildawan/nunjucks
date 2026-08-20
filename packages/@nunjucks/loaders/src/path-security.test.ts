import { describe, expect, test } from 'bun:test';
import { containsNullByte, isWithinBase } from './path-security.ts';

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

  test('rejects sibling directories sharing a string prefix', () => {
    expect(isWithinBase('/var/www', '/var/www2/app')).toBe(false);
    expect(isWithinBase('/var/www', '/var/www-archive/app')).toBe(false);
  });

  test('fails closed for non-canonical or relative inputs', () => {
    expect(isWithinBase('var/www', 'var/www/app/index.html')).toBe(false);
    expect(isWithinBase('/var/www', '/var/www/../secret')).toBe(false);
  });

  test('compares win32 drive roots and segments case-insensitively', () => {
    expect(isWithinBase('C:\\www', 'c:\\www\\app\\index.html')).toBe(true);
    expect(isWithinBase('C:\\www', 'c:\\WWW2\\app')).toBe(false);
  });

  test('separators are interchangeable per segment comparison', () => {
    expect(isWithinBase('/var/www', '/var/www\\app/index.html')).toBe(true);
  });
});
