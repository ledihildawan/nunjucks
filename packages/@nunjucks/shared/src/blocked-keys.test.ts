import { describe, expect, test } from 'bun:test';
import {
  BLOCKED_KEYS_LIST,
  CODE_EXECUTION_KEYS,
  DANGEROUS_GLOBALS_LIST,
  DANGEROUS_KEY_PATTERN,
  ENVIRONMENTS,
  OBJECT_INTRINSICS,
} from './blocked-keys.ts';

describe('blocked-keys', () => {
  describe('exported lists', () => {
    test('BLOCKED_KEYS_LIST contains expected keys', () => {
      expect(BLOCKED_KEYS_LIST).toContain('eval');
      expect(BLOCKED_KEYS_LIST).toContain('__proto__');
      expect(BLOCKED_KEYS_LIST).toContain('process');
    });

    test('DANGEROUS_GLOBALS_LIST contains expected globals', () => {
      expect(DANGEROUS_GLOBALS_LIST).toContain('eval');
      expect(DANGEROUS_GLOBALS_LIST).toContain('globalThis');
    });

    test('OBJECT_INTRINSICS contains prototype properties', () => {
      expect(OBJECT_INTRINSICS).toContain('__proto__');
      expect(OBJECT_INTRINSICS).toContain('constructor');
    });

    test('CODE_EXECUTION_KEYS contains execution patterns', () => {
      expect(CODE_EXECUTION_KEYS).toContain('eval');
      expect(CODE_EXECUTION_KEYS).toContain('Function');
      expect(CODE_EXECUTION_KEYS).toContain('exec');
    });

    test('ENVIRONMENTS has correct values', () => {
      expect(ENVIRONMENTS).toEqual({
        NODE: 'node',
        BROWSER: 'browser',
        DENO: 'deno',
      });
    });
  });

  describe('DANGEROUS_KEY_PATTERN', () => {
    test('matches top-level navigation and process globals', () => {
      expect(DANGEROUS_KEY_PATTERN.test('globalThis')).toBe(true);
      expect(DANGEROUS_KEY_PATTERN.test('process')).toBe(true);
      expect(DANGEROUS_KEY_PATTERN.test('window')).toBe(true);
    });

    test('does not match substrings of safe keys', () => {
      expect(DANGEROUS_KEY_PATTERN.test('topLevel')).toBe(false);
      expect(DANGEROUS_KEY_PATTERN.test('parentItem')).toBe(false);
      expect(DANGEROUS_KEY_PATTERN.test('user')).toBe(false);
    });
  });
});
