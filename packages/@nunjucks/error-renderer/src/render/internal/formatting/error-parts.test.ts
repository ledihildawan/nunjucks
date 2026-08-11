import { describe, test, expect } from 'bun:test';
import { mergeErrorParts } from './error-parts.ts';

describe('mergeErrorParts', () => {
  describe('classification-driven merge', () => {
    test('uses classification causes for a known UNDEFINED_VARIABLE error', () => {
      const parts = mergeErrorParts({
        code: 'UNDEFINED_VARIABLE',
        subject: 'foo',
        message: "Variable 'foo' is not defined",
      });
      expect(parts.causes.some((cause) => cause.includes('foo'))).toBe(true);
    });

    test('uses classification fixCode with subject substitution for UNDEFINED_FILTER', () => {
      const parts = mergeErrorParts({
        code: 'UNDEFINED_FILTER',
        subject: 'myFilter',
        message: "Filter 'myFilter' is not defined",
      });
      expect(parts.fixCode).toContain('myFilter');
      expect(parts.fixCode).not.toContain('{subject}');
    });

    test('surfaces errObj.causes through the classification pipeline when provided', () => {
      const parts = mergeErrorParts({
        code: 'UNDEFINED_VARIABLE',
        subject: 'foo',
        message: "Variable 'foo' is not defined",
        causes: ['custom cause from the error object'],
      });
      expect(parts.causes).toContain('custom cause from the error object');
    });

    test('uses rule causes when errObj.causes is empty', () => {
      const parts = mergeErrorParts({
        code: 'UNDEFINED_VARIABLE',
        subject: 'foo',
        message: "Variable 'foo' is not defined",
        causes: [],
      });
      expect(parts.causes.some((cause) => cause.includes('foo'))).toBe(true);
    });
  });

  describe('errObj fallback', () => {
    test('falls back to errObj.documentationUrl when classification has none', () => {
      const customDocUrl = 'https://example.com/custom-docs';
      const parts = mergeErrorParts({
        message: 'something completely uncatalogued happened',
        documentationUrl: customDocUrl,
      });
      expect(parts.documentationUrl).toBe(customDocUrl);
    });

    test('uses default classification for an unknown error with no errObj hints', () => {
      const parts = mergeErrorParts({ message: 'an entirely unknown failure' });
      expect(parts.causes.length).toBeGreaterThan(0);
      expect(parts.fixCode).not.toBe('');
      expect(parts.fixComment).not.toBe('');
      expect(parts.documentationUrl).toBeNull();
    });

    test('returns defaults for an empty error object', () => {
      const parts = mergeErrorParts({});
      expect(parts.causes.length).toBeGreaterThan(0);
      expect(parts.fixCode).not.toBe('');
    });
  });

  describe('return shape', () => {
    test('always returns the four merged keys with valid types', () => {
      const parts = mergeErrorParts({ message: 'boom' });
      expect(Array.isArray(parts.causes)).toBe(true);
      expect(typeof parts.fixCode).toBe('string');
      expect(typeof parts.fixComment).toBe('string');
      expect(parts.documentationUrl === null || typeof parts.documentationUrl === 'string').toBe(true);
    });
  });
});
