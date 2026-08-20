import { describe, expect, test } from 'bun:test';
import { escapeForContext } from './escaping/index.ts';
import { suppressValue } from './index.ts';
import { createSafeString } from './runtime-contract/safe-string.ts';

describe('suppressValue', () => {
  test('returns empty string for null and undefined', () => {
    expect(suppressValue(null)).toBe('');
    expect(suppressValue(undefined)).toBe('');
  });

  test('returns empty string for null and undefined in script context', () => {
    // WHY: regression — null hit the script JSON guard before nullish normalization
    // and rendered the literal string "null" (undefined already fell through).
    expect(suppressValue(null, { autoescape: true, context: 'script' })).toBe('');
    expect(suppressValue(undefined, { autoescape: true, context: 'script' })).toBe('');
  });

  test('SafeStrings pass through html/script contexts but are escaped in attribute contexts', () => {
    // WHY: regression — tojson (SafeString) in a delimited/undelimited attribute used
    // to bypass context escaping, so JSON structural quotes terminated the attribute.
    const safeJson = '{"note":"x\\" onmouseover=\\"alert(1)"}';
    const safeString = createSafeString(safeJson);
    // html/script: the SafeString object itself passes through (toString yields val)
    expect(String(suppressValue(safeString, { autoescape: true }))).toBe(safeJson);
    expect(String(suppressValue(safeString, { autoescape: true, context: 'script' }))).toBe(
      safeJson
    );
    // attribute contexts: escaped PRIMITIVE string — quotes can no longer terminate
    const quoted = suppressValue(safeString, {
      autoescape: true,
      context: 'attribute',
    }) as string;
    expect(quoted).toBe(escapeForContext(safeJson, 'attribute'));
    expect(quoted).not.toContain('"note":"x');
    expect(suppressValue(safeString, { autoescape: true, context: 'unquoted-attribute' })).toBe(
      escapeForContext(safeJson, 'unquoted-attribute')
    );
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
      'a&amp;b&lt;c&gt;d&quot;e&#39;f&#92;g'
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
