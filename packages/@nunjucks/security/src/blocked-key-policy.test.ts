import { describe, expect, test } from 'bun:test';
import {
  getBlockedKeyCategory,
  isBlockedKey,
  isCodeExecutionPattern,
  isDangerousGlobal,
  isPrototypeEscapeKey,
} from './blocked-key-policy.ts';

describe('blocked-key-policy', () => {
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

  describe('isPrototypeEscapeKey', () => {
    test('blocks the prototype-chain escape trio', () => {
      expect(isPrototypeEscapeKey('__proto__')).toBe(true);
      expect(isPrototypeEscapeKey('constructor')).toBe(true);
      expect(isPrototypeEscapeKey('prototype')).toBe(true);
    });

    test('allows harmless inherited members', () => {
      expect(isPrototypeEscapeKey('toString')).toBe(false);
      expect(isPrototypeEscapeKey('valueOf')).toBe(false);
      expect(isPrototypeEscapeKey('hasOwnProperty')).toBe(false);
    });
  });
});
