import { describe, test, expect } from 'bun:test';
import {
  isBlockedKey,
  isDangerousGlobal,
  getBlockedKeyCategory,
  isCodeExecutionPattern,
  ENVIRONMENTS,
  BLOCKED_KEYS_LIST,
  DANGEROUS_GLOBALS_LIST,
  OBJECT_INTRINSICS,
  CODE_EXECUTION_KEYS,
} from './blocked-keys.ts';

describe('blocked-keys', () => {
  describe('getBlockedKeyCategory', () => {
    test('returns object_intrinsic for prototype properties', () => {
      expect(getBlockedKeyCategory('__proto__')).toBe('object_intrinsic');
      expect(getBlockedKeyCategory('constructor')).toBe('object_intrinsic');
      expect(getBlockedKeyCategory('prototype')).toBe('object_intrinsic');
    });

    test('returns universal_global for universal dangerous globals', () => {
      expect(getBlockedKeyCategory('eval')).toBe('universal_global');
      expect(getBlockedKeyCategory('Function')).toBe('universal_global');
      expect(getBlockedKeyCategory('Proxy')).toBe('universal_global');
    });

    test('returns node_global in auto env', () => {
      expect(getBlockedKeyCategory('process', 'auto')).toBe('node_global');
      expect(getBlockedKeyCategory('Buffer', 'auto')).toBe('node_global');
    });

    test('returns browser_global in auto env', () => {
      expect(getBlockedKeyCategory('window', 'auto')).toBe('browser_global');
      expect(getBlockedKeyCategory('document', 'auto')).toBe('browser_global');
    });

    test('returns null for safe keys', () => {
      expect(getBlockedKeyCategory('myVar')).toBe(null);
      expect(getBlockedKeyCategory('data')).toBe(null);
    });
  });

  describe('isBlockedKey', () => {
    test('blocks object intrinsics in all environments', () => {
      expect(isBlockedKey('__proto__')).toBe(true);
      expect(isBlockedKey('constructor')).toBe(true);
    });

    test('blocks universal globals in all environments', () => {
      expect(isBlockedKey('eval')).toBe(true);
      expect(isBlockedKey('Function')).toBe(true);
    });

    test('blocks node globals when env is node', () => {
      expect(isBlockedKey('process', 'node')).toBe(true);
      expect(isBlockedKey('Buffer', 'node')).toBe(true);
    });

    test('blocks browser globals when env is browser', () => {
      expect(isBlockedKey('window', 'browser')).toBe(true);
      expect(isBlockedKey('document', 'browser')).toBe(true);
    });

    test('allows safe keys', () => {
      expect(isBlockedKey('myVariable')).toBe(false);
      expect(isBlockedKey('userData')).toBe(false);
    });

    test('handles auto environment correctly', () => {
      expect(isBlockedKey('process', 'auto')).toBe(true);
      expect(isBlockedKey('window', 'auto')).toBe(true);
    });
  });

  describe('isDangerousGlobal', () => {
    test('identifies dangerous globals', () => {
      expect(isDangerousGlobal('eval')).toBe(true);
      expect(isDangerousGlobal('Function')).toBe(true);
      expect(isDangerousGlobal('process')).toBe(true);
      expect(isDangerousGlobal('window')).toBe(true);
    });

    test('returns false for safe keys', () => {
      expect(isDangerousGlobal('Array')).toBe(false);
      expect(isDangerousGlobal('Object')).toBe(false);
      expect(isDangerousGlobal('Math')).toBe(false);
    });
  });

  describe('isCodeExecutionPattern', () => {
    test('identifies code execution patterns', () => {
      expect(isCodeExecutionPattern('eval')).toBe(true);
      expect(isCodeExecutionPattern('Function')).toBe(true);
      expect(isCodeExecutionPattern('setTimeout')).toBe(true);
      expect(isCodeExecutionPattern('setInterval')).toBe(true);
    });

    test('returns false for non-execution patterns', () => {
      expect(isCodeExecutionPattern('Array')).toBe(false);
      expect(isCodeExecutionPattern('Object')).toBe(false);
    });
  });

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
});
