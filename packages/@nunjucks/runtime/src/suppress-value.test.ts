import { describe, test, expect } from 'bun:test';
import { suppressValue } from './index.ts';
import { createSafeString } from './runtime-contract/safe-string.ts';

describe('suppressValue', () => {
  test('returns empty string for null and undefined', () => {
    expect(suppressValue(null)).toBe('');
    expect(suppressValue(undefined)).toBe('');
  });

  test('returns value unchanged when autoescape is falsy', () => {
    expect(suppressValue('hello', { autoescape: false })).toBe('hello');
    expect(suppressValue(42, { autoescape: false })).toBe(42);
    expect(suppressValue(false, { autoescape: false })).toBe(false);
  });

  test('escapes HTML entities when autoescape is true', () => {
    expect(suppressValue('<script>', { autoescape: true })).toBe('&lt;script&gt;');
  });

  test('escapes all special characters', () => {
    expect(suppressValue('a&b<c>d"e\'f\\g', { autoescape: true })).toBe(
      'a&amp;b&lt;c&gt;d&quot;e&#39;f&#92;g',
    );
  });

  test('coerces non-string to string when autoescaping', () => {
    expect(suppressValue(42, { autoescape: true })).toBe('42');
  });

  test('does not double-escape SafeString', () => {
    const safe = createSafeString('<b>bold</b>');
    expect(suppressValue(safe, { autoescape: true })).toBe(safe);
  });

  test('resolves promises and suppresses the resolved value', async () => {
    expect(await suppressValue(Promise.resolve('hi'), { autoescape: false })).toBe('hi');
    expect(await suppressValue(Promise.resolve(null), { autoescape: false })).toBe('');
  });

  test('resolves promises with autoescape applied to the resolved value', async () => {
    expect(await suppressValue(Promise.resolve('<a>'), { autoescape: true })).toBe('&lt;a&gt;');
  });
});
