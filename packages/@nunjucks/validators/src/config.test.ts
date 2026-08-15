import { describe, expect, test } from 'bun:test';
import { isErr, isOk } from '@nunjucks/lib';
import { validateConfig } from '@nunjucks/validators';
import { getReservedKeywords, RESERVED_KEYWORDS } from './reserved.ts';

describe('validateConfig - reserved keyword validation', () => {
  describe('filters', () => {
    test('rejects nunjucks template keyword as filter name', () => {
      const result = validateConfig({ customFilters: { if: () => {} } });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        const error = result.error[0];
        expect(error.message).toContain('reserved');
        expect(error.message).toContain('filter');
      }
    });

    test('rejects JavaScript built-in as filter name', () => {
      const result = validateConfig({ customFilters: { Array: () => {} } });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        const error = result.error[0];
        expect(error.message).toContain('reserved');
      }
    });

    test('rejects nunjucks runtime global as filter name', () => {
      const result = validateConfig({ customFilters: { range: () => {} } });
      expect(isErr(result)).toBe(true);
    });

    test('rejects existing filter name as filter name', () => {
      const result = validateConfig({ customFilters: { upper: () => {} } });
      expect(isErr(result)).toBe(true);
    });

    test('accepts non-reserved filter names', () => {
      const result = validateConfig({ customFilters: { myCustomFilter: () => {} } });
      expect(isOk(result)).toBe(true);
    });

    test('rejects multiple reserved filter names in one config', () => {
      const result = validateConfig({
        customFilters: {
          if: () => {},
          Array: () => {},
          upper: () => {},
        },
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(3);
      }
    });
  });

  describe('globals', () => {
    test('rejects nunjucks template keyword as global name', () => {
      const result = validateConfig({ customGlobals: { for: {} } });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        const error = result.error[0];
        expect(error.message).toContain('reserved');
        expect(error.message).toContain('global');
      }
    });

    test('rejects JavaScript built-in as global name', () => {
      const result = validateConfig({ customGlobals: { Object: {} } });
      expect(isErr(result)).toBe(true);
    });

    test('rejects nunjucks runtime global as global name', () => {
      const result = validateConfig({ customGlobals: { cycler: {} } });
      expect(isErr(result)).toBe(true);
    });

    test('accepts non-reserved global names', () => {
      const result = validateConfig({ customGlobals: { myGlobal: {} } });
      expect(isOk(result)).toBe(true);
    });

    test('rejects multiple reserved global names in one config', () => {
      const result = validateConfig({
        customGlobals: {
          for: {},
          String: {},
          log: {},
        },
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(3);
      }
    });
  });

  describe('mixed filters and globals', () => {
    test('rejects reserved keywords in both filters and globals', () => {
      const result = validateConfig({
        customFilters: { if: () => {} },
        customGlobals: { Array: {} },
      });
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error).toHaveLength(2);
      }
    });

    test('accepts valid filters and globals together', () => {
      const result = validateConfig({
        customFilters: { myFilter: () => {} },
        customGlobals: { myGlobal: {} },
      });
      expect(isOk(result)).toBe(true);
    });
  });

  describe('error codes', () => {
    test('returns RESERVED_KEYWORD error code for filters', () => {
      const result = validateConfig({ customFilters: { if: () => {} } });
      if (isErr(result)) {
        const error = result.error[0];
        expect(error.code).toBe('RESERVED_KEYWORD');
        expect(error.subject).toBe('if');
        expect(error.type).toBe('filter');
      }
    });

    test('returns RESERVED_KEYWORD error code for globals', () => {
      const result = validateConfig({ customGlobals: { for: {} } });
      if (isErr(result)) {
        const error = result.error[0];
        expect(error.code).toBe('RESERVED_KEYWORD');
        expect(error.subject).toBe('for');
        expect(error.type).toBe('global');
      }
    });
  });

  describe('Result shape', () => {
    test('ok branch is an Ok with undefined value', () => {
      const result = validateConfig({ customFilters: { myFilter: () => {} } });
      if (isOk(result)) {
        expect(result.value).toBeUndefined();
      } else {
        throw new Error('should be valid');
      }
    });

    test('err branch narrows error to a non-empty tuple with at least one element', () => {
      const result = validateConfig({ customFilters: { if: () => {} } });
      if (isErr(result)) {
        expect(result.error.length).toBeGreaterThanOrEqual(1);
        expect(result.error[0]).toBeDefined();
      } else {
        throw new Error('should be invalid');
      }
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
