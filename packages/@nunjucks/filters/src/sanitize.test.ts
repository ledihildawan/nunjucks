import { describe, expect, test } from 'bun:test';
import { isOk, isSafeString } from '@nunjucks/lib';
import { sanitize } from './sanitize.ts';

describe('sanitize filter', () => {
  describe('return type', () => {
    test('returns an ok result wrapping a SafeString', () => {
      const result = sanitize('<b>x</b>');
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) {
        throw new Error('expected ok');
      }
      expect(isSafeString(result.value)).toBe(true);
    });

    test('toString yields a string of the cleaned markup', () => {
      const result = sanitize('<b>x</b><script>bad</script>');
      if (!isOk(result)) {
        throw new Error('expected ok');
      }
      expect(result.value.toString()).toBe('<b>x</b>');
    });
  });

  describe('DOMPurify config', () => {
    test('respects ALLOWED_TAGS to narrow the tag set', () => {
      const result = sanitize('<b>bold</b><i>italic</i>', { ALLOWED_TAGS: ['b'] });
      if (!isOk(result)) {
        throw new Error('expected ok');
      }
      expect(result.value.toString()).toContain('<b>bold</b>');
      expect(result.value.toString()).not.toContain('<i>');
    });

    test('respects FORBID_TAGS to drop specific tags', () => {
      const result = sanitize('<b>bold</b><i>italic</i>', { FORBID_TAGS: ['i'] });
      if (!isOk(result)) {
        throw new Error('expected ok');
      }
      expect(result.value.toString()).toContain('<b>bold</b>');
      expect(result.value.toString()).not.toContain('<i>');
    });

    test('default config keeps both <b> and <i>', () => {
      const result = sanitize('<b>bold</b><i>italic</i>');
      if (!isOk(result)) {
        throw new Error('expected ok');
      }
      expect(result.value.toString()).toContain('<b>bold</b>');
      expect(result.value.toString()).toContain('<i>');
    });

    test('still returns a SafeString when given a custom config', () => {
      const result = sanitize('<b>x</b>', { ALLOWED_TAGS: ['b'] });
      if (!isOk(result)) {
        throw new Error('expected ok');
      }
      expect(isSafeString(result.value)).toBe(true);
    });
  });
});
