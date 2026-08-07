import { describe, test, expect } from 'bun:test';
import { isSafeString } from '@nunjucks/runtime';
import { sanitize } from './sanitize.ts';

describe('sanitize filter', () => {
  describe('return type', () => {
    test('returns a SafeString', () => {
      const result = sanitize('<b>x</b>');
      expect(isSafeString(result)).toBe(true);
    });

    test('toString yields a string of the cleaned markup', () => {
      const result = sanitize('<b>x</b><script>bad</script>');
      expect(typeof result.toString()).toBe('string');
      expect(result.toString()).toBe('<b>x</b>');
    });
  });

  describe('DOMPurify config', () => {
    test('respects ALLOWED_TAGS to narrow the tag set', () => {
      const result = sanitize('<b>bold</b><i>italic</i>', { ALLOWED_TAGS: ['b'] });
      expect(result.toString()).toContain('<b>bold</b>');
      expect(result.toString()).not.toContain('<i>');
    });

    test('respects FORBID_TAGS to drop specific tags', () => {
      const result = sanitize('<b>bold</b><i>italic</i>', { FORBID_TAGS: ['i'] });
      expect(result.toString()).toContain('<b>bold</b>');
      expect(result.toString()).not.toContain('<i>');
    });

    test('default config keeps both <b> and <i>', () => {
      const result = sanitize('<b>bold</b><i>italic</i>');
      expect(result.toString()).toContain('<b>bold</b>');
      expect(result.toString()).toContain('<i>italic</i>');
    });

    test('still returns a SafeString when given a custom config', () => {
      const result = sanitize('<b>x</b>', { ALLOWED_TAGS: ['b'] });
      expect(isSafeString(result)).toBe(true);
    });
  });
});