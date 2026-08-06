import { expect, describe, test } from 'bun:test';
import { validateConfig } from '@nunjucks/validators';
import { RESERVED_KEYWORDS, getReservedKeywords } from '@nunjucks/shared';

describe('validateConfig - reserved keyword validation', () => {
  describe('filters', () => {
    test('rejects nunjucks template keyword as filter name', () => {
      const result = validateConfig({ _customFilters: { 'if': () => {} } });
      expect(result.valid).toBe(false);
      const error = result.errors[0]!;
      expect(error.message).toContain('reserved');
      expect(error.message).toContain('filter');
    });

    test('rejects JavaScript built-in as filter name', () => {
      const result = validateConfig({ _customFilters: { 'Array': () => {} } });
      expect(result.valid).toBe(false);
      const error = result.errors[0]!;
      expect(error.message).toContain('reserved');
    });

    test('rejects nunjucks runtime global as filter name', () => {
      const result = validateConfig({ _customFilters: { 'range': () => {} } });
      expect(result.valid).toBe(false);
    });

    test('rejects existing filter name as filter name', () => {
      const result = validateConfig({ _customFilters: { 'upper': () => {} } });
      expect(result.valid).toBe(false);
    });

    test('accepts non-reserved filter names', () => {
      const result = validateConfig({ _customFilters: { 'myCustomFilter': () => {} } });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects multiple reserved filter names in one config', () => {
      const result = validateConfig({
        _customFilters: {
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
      const result = validateConfig({ _customGlobals: { 'for': {} } });
      expect(result.valid).toBe(false);
      const error = result.errors[0]!;
      expect(error.message).toContain('reserved');
      expect(error.message).toContain('global');
    });

    test('rejects JavaScript built-in as global name', () => {
      const result = validateConfig({ _customGlobals: { 'Object': {} } });
      expect(result.valid).toBe(false);
    });

    test('rejects nunjucks runtime global as global name', () => {
      const result = validateConfig({ _customGlobals: { 'cycler': {} } });
      expect(result.valid).toBe(false);
    });

    test('accepts non-reserved global names', () => {
      const result = validateConfig({ _customGlobals: { 'myGlobal': {} } });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects multiple reserved global names in one config', () => {
      const result = validateConfig({
        _customGlobals: {
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
        _customFilters: { 'if': () => {} },
        _customGlobals: { 'Array': {} }
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    test('accepts valid filters and globals together', () => {
      const result = validateConfig({
        _customFilters: { 'myFilter': () => {} },
        _customGlobals: { 'myGlobal': {} }
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('error codes', () => {
    test('returns RESERVED_KEYWORD error code for filters', () => {
      const result = validateConfig({ _customFilters: { 'if': () => {} } });
      const error = result.errors[0]!;
      expect(error.code).toBe('RESERVED_KEYWORD');
      expect(error.subject).toBe('if');
      expect(error.type).toBe('filter');
    });

    test('returns RESERVED_KEYWORD error code for globals', () => {
      const result = validateConfig({ _customGlobals: { 'for': {} } });
      const error = result.errors[0]!;
      expect(error.code).toBe('RESERVED_KEYWORD');
      expect(error.subject).toBe('for');
      expect(error.type).toBe('global');
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