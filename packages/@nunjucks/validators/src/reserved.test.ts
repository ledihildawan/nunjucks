import { describe, test, expect } from 'bun:test';
import { RESERVED_KEYWORDS, validateFilterName, validateGlobalName, getReservedKeywords } from './reserved.ts';
import { isOk, isErr } from '@nunjucks/lib';

describe('RESERVED_KEYWORDS', () => {
  test('contains template keywords, JS builtins, and literals', () => {
    expect(RESERVED_KEYWORDS.has('if')).toBe(true);
    expect(RESERVED_KEYWORDS.has('for')).toBe(true);
    expect(RESERVED_KEYWORDS.has('eval')).toBe(true);
    expect(RESERVED_KEYWORDS.has('constructor')).toBe(true);
    expect(RESERVED_KEYWORDS.has('true')).toBe(true);
  });

  test('auto-includes the security blocked-keys registry', () => {
    expect(RESERVED_KEYWORDS.has('process')).toBe(true);
    expect(RESERVED_KEYWORDS.has('globalThis')).toBe(true);
  });
});

describe('validateFilterName', () => {
  test('rejects reserved names with a descriptive error', () => {
    const result = validateFilterName('eval');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('RESERVED_KEYWORD');
      expect(result.error.subject).toBe('eval');
      expect(result.error.type).toBe('filter');
      expect(result.error.message).toContain('filter');
    }
  });

  test('accepts non-reserved names', () => {
    expect(isOk(validateFilterName('myFilter'))).toBe(true);
  });
});

describe('validateGlobalName', () => {
  test('rejects reserved names labelled as global', () => {
    const result = validateGlobalName('process');
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.type).toBe('global');
    }
  });

  test('accepts non-reserved names', () => {
    expect(isOk(validateGlobalName('myGlobal'))).toBe(true);
  });
});

describe('getReservedKeywords', () => {
  test('returns a fresh array containing the set members', () => {
    const arr = getReservedKeywords();
    expect(Array.isArray(arr)).toBe(true);
    expect(arr).toContain('if');
    expect(new Set(arr).size).toBe(arr.length);
  });
});
