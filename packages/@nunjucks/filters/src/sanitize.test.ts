import { describe, expect, test } from 'bun:test';
import { getOrElse, isOk, isSafeString } from '@nunjucks/lib';
import { sanitize } from './sanitize.ts';

describe('sanitize filter', () => {
  describe('return type', () => {
    test('returns an ok result wrapping a SafeString', () => {
      const result = sanitize('<b>x</b>');
      expect(isOk(result)).toBe(true);
      expect(isSafeString(getOrElse(result, null))).toBe(true);
    });

    test('toString yields a string of the cleaned markup', () => {
      const result = getOrElse(sanitize('<b>x</b><script>bad</script>'), null!);
      expect(typeof result.toString()).toBe('string');
      expect(result.toString()).toBe('<b>x</b>');
    });
  });

  describe('DOMPurify config', () => {
    test('respects ALLOWED_TAGS to narrow the tag set', () => {
      const result = getOrElse(
        sanitize('<b>bold</b><i>italic</i>', { ALLOWED_TAGS: ['b'] }),
        null!
      );
      expect(result.toString()).toContain('<b>bold</b>');
      expect(result.toString()).not.toContain('<i>');
    });

    test('respects FORBID_TAGS to drop specific tags', () => {
      const result = getOrElse(sanitize('<b>bold</b><i>italic</i>', { FORBID_TAGS: ['i'] }), null!);
      expect(result.toString()).toContain('<b>bold</b>');
      expect(result.toString()).not.toContain('<i>');
    });

    test('default config keeps both <b> and <i>', () => {
      const result = getOrElse(sanitize('<b>bold</b><i>italic</i>'), null!);
      expect(result.toString()).toContain('<b>bold</b>');
      expect(result.toString()).toContain('<i>');
    });

    test('still returns a SafeString when given a custom config', () => {
      const result = getOrElse(sanitize('<b>x</b>', { ALLOWED_TAGS: ['b'] }), null!);
      expect(isSafeString(result)).toBe(true);
    });
  });
});
