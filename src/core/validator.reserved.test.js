import { expect, describe, test } from 'bun:test';
import { validateConfig } from './validator.js';
import { RESERVED_KEYWORDS, getReservedKeywords } from '../config/reserved.js';

describe('validateConfig - reserved keyword validation', () => {
  describe('filters', () => {
    test('rejects nunjucks template keyword as filter name', () => {
      const result = validateConfig({ filters: { 'if': () => {} } });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('reserved');
      expect(result.errors[0].message).toContain('filter');
    });

    test('rejects JavaScript built-in as filter name', () => {
      const result = validateConfig({ filters: { 'Array': () => {} } });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('reserved');
    });

    test('rejects nunjucks runtime global as filter name', () => {
      const result = validateConfig({ filters: { 'range': () => {} } });
      expect(result.valid).toBe(false);
    });

    test('rejects existing filter name as filter name', () => {
      const result = validateConfig({ filters: { 'upper': () => {} } });
      expect(result.valid).toBe(false);
    });

    test('accepts non-reserved filter names', () => {
      const result = validateConfig({ filters: { 'myCustomFilter': () => {} } });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects multiple reserved filter names in one config', () => {
      const result = validateConfig({
        filters: {
          'if': () => {},
          'Array': () => {},
          'upper': () => {}
        }
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe('globals', () => {
    test('rejects nunjucks template keyword as global name', () => {
      const result = validateConfig({ globals: { 'for': {} } });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('reserved');
      expect(result.errors[0].message).toContain('global');
    });

    test('rejects JavaScript built-in as global name', () => {
      const result = validateConfig({ globals: { 'Object': {} } });
      expect(result.valid).toBe(false);
    });

    test('rejects nunjucks runtime global as global name', () => {
      const result = validateConfig({ globals: { 'cycler': {} } });
      expect(result.valid).toBe(false);
    });

    test('accepts non-reserved global names', () => {
      const result = validateConfig({ globals: { 'myGlobal': {} } });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects multiple reserved global names in one config', () => {
      const result = validateConfig({
        globals: {
          'for': {},
          'String': {},
          'log': {}
        }
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe('mixed filters and globals', () => {
    test('rejects reserved keywords in both filters and globals', () => {
      const result = validateConfig({
        filters: { 'if': () => {} },
        globals: { 'Array': {} }
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    test('accepts valid filters and globals together', () => {
      const result = validateConfig({
        filters: { 'myFilter': () => {} },
        globals: { 'myGlobal': {} }
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('error codes', () => {
    test('returns RESERVED_KEYWORD error code for filters', () => {
      const result = validateConfig({ filters: { 'if': () => {} } });
      expect(result.errors[0].code).toBe('RESERVED_KEYWORD');
    });

    test('returns RESERVED_KEYWORD error code for globals', () => {
      const result = validateConfig({ globals: { 'for': {} } });
      expect(result.errors[0].code).toBe('RESERVED_KEYWORD');
    });
  });
});

describe('RESERVED_KEYWORDS', () => {
  test('includes nunjucks template keywords', () => {
    expect(RESERVED_KEYWORDS.has('if')).toBe(true);
    expect(RESERVED_KEYWORDS.has('for')).toBe(true);
    expect(RESERVED_KEYWORDS.has('block')).toBe(true);
  });

  test('includes JavaScript built-ins', () => {
    expect(RESERVED_KEYWORDS.has('Array')).toBe(true);
    expect(RESERVED_KEYWORDS.has('Object')).toBe(true);
    expect(RESERVED_KEYWORDS.has('String')).toBe(true);
  });

  test('includes nunjucks runtime globals', () => {
    expect(RESERVED_KEYWORDS.has('range')).toBe(true);
    expect(RESERVED_KEYWORDS.has('cycler')).toBe(true);
  });

  test('getReservedKeywords returns array', () => {
    const keywords = getReservedKeywords();
    expect(Array.isArray(keywords)).toBe(true);
    expect(keywords.length).toBeGreaterThan(50);
  });
});
