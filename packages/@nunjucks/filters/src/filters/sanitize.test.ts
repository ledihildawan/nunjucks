import { describe, test, expect } from 'bun:test';
import { render } from '@nunjucks/core';
import { isSafeString } from '@nunjucks/runtime';
import { sanitize } from './sanitize.ts';

const renderTemplate = async (template: string, context: Record<string, unknown> = {}) =>
  await render(template, context, { autoescape: false });

describe('sanitize filter', () => {
  describe('basic HTML sanitization', () => {
    test('strips <script> tags and their content', async () => {
      const result = await renderTemplate('{{ x |> sanitize }}', { x: '<script>alert(1)</script>' });
      expect(result).toBe('');
    });

    test('strips onerror event handler but keeps the tag', async () => {
      const result = await renderTemplate('{{ x |> sanitize }}', { x: '<img src="x" onerror="alert(1)">' });
      expect(result).toContain('<img');
      expect(result).toContain('src');
      expect(result).not.toContain('onerror');
    });

    test('strips inline event handlers from safe tags', async () => {
      const result = await renderTemplate('{{ x |> sanitize }}', { x: '<a href="x" onclick="alert(1)">link</a>' });
      expect(result).not.toContain('onclick');
      expect(result).toContain('<a');
      expect(result).toContain('link');
    });

    test('strips javascript: href', async () => {
      const result = await renderTemplate('{{ x |> sanitize }}', { x: '<a href="javascript:alert(1)">x</a>' });
      expect(result).not.toContain('javascript:');
    });
  });

  describe('keeps safe markup', () => {
    test('keeps <b>, <i>, <p>', async () => {
      const result = await renderTemplate('{{ x |> sanitize }}', { x: '<b>bold</b><i>italic</i><p>para</p>' });
      expect(result).toContain('<b>bold</b>');
      expect(result).toContain('<i>italic</i>');
      expect(result).toContain('<p>para</p>');
    });

    test('keeps nested safe tags unchanged', async () => {
      const result = await renderTemplate('{{ x |> sanitize }}', { x: '<p>Hello <b>world</b></p>' });
      expect(result).toBe('<p>Hello <b>world</b></p>');
    });

    test('leaves plain text untouched', async () => {
      const result = await renderTemplate('{{ x |> sanitize }}', { x: 'just text' });
      expect(result).toBe('just text');
    });
  });

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

  describe('edge cases', () => {
    test('empty string yields empty string', async () => {
      const result = await renderTemplate('{{ x |> sanitize }}', { x: '' });
      expect(result).toBe('');
    });

    test('null is coerced to the literal string "null"', async () => {
      const result = await renderTemplate('{{ x |> sanitize }}', { x: null });
      expect(result).toBe('null');
    });

    test('undefined is coerced to the literal string "undefined"', async () => {
      const result = await renderTemplate('{{ x |> sanitize }}', { x: undefined });
      expect(result).toBe('undefined');
    });

    test('number is coerced to its string form', async () => {
      const result = await renderTemplate('{{ x |> sanitize }}', { x: 42 });
      expect(result).toBe('42');
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
