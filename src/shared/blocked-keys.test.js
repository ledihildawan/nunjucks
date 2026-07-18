import { describe, test, expect } from 'bun:test';
import {
  isBlockedKey,
  isDangerousGlobal,
  isCodeExecutionPattern,
  getBlockedKeyCategory,
  BLOCKED_KEY_CATEGORIES,
  BLOCKED_KEYS_LIST,
  DANGEROUS_GLOBALS_LIST,
} from './blocked-keys.js';

describe('isBlockedKey', () => {
  test('returns true for blocked keys', () => {
    expect(isBlockedKey('__proto__')).toBe(true);
    expect(isBlockedKey('constructor')).toBe(true);
    expect(isBlockedKey('prototype')).toBe(true);
    expect(isBlockedKey('hasOwnProperty')).toBe(true);
    expect(isBlockedKey('toString')).toBe(true);
    expect(isBlockedKey('valueOf')).toBe(true);
    expect(isBlockedKey('global')).toBe(true);
    expect(isBlockedKey('globalThis')).toBe(true);
    expect(isBlockedKey('window')).toBe(true);
    expect(isBlockedKey('process')).toBe(true);
    expect(isBlockedKey('eval')).toBe(true);
    expect(isBlockedKey('Function')).toBe(true);
    expect(isBlockedKey('document')).toBe(true);
    expect(isBlockedKey('Deno')).toBe(true);
    expect(isBlockedKey('Reflect')).toBe(true);
  });

  test('returns false for normal keys', () => {
    expect(isBlockedKey('name')).toBe(false);
    expect(isBlockedKey('value')).toBe(false);
    expect(isBlockedKey('user')).toBe(false);
    expect(isBlockedKey('setTimeout')).toBe(false);
    expect(isBlockedKey('map')).toBe(false);
  });

  test('honors explicit environment scopes', () => {
    expect(isBlockedKey('process', 'node')).toBe(true);
    expect(isBlockedKey('process', 'browser')).toBe(false);
    expect(isBlockedKey('document', 'browser')).toBe(true);
    expect(isBlockedKey('document', 'node')).toBe(false);
    expect(isBlockedKey('Deno', 'deno')).toBe(true);
    expect(isBlockedKey('Deno', 'node')).toBe(false);
  });
});

describe('isDangerousGlobal', () => {
  test('returns true for dangerous globals', () => {
    expect(isDangerousGlobal('global')).toBe(true);
    expect(isDangerousGlobal('globalThis')).toBe(true);
    expect(isDangerousGlobal('window')).toBe(true);
    expect(isDangerousGlobal('process')).toBe(true);
    expect(isDangerousGlobal('eval')).toBe(true);
    expect(isDangerousGlobal('Function')).toBe(true);
    expect(isDangerousGlobal('require')).toBe(true);
    expect(isDangerousGlobal('document')).toBe(true);
    expect(isDangerousGlobal('Deno')).toBe(true);
  });

  test('returns false for normal globals', () => {
    expect(isDangerousGlobal('console')).toBe(false);
    expect(isDangerousGlobal('Array')).toBe(false);
  });
});

describe('isCodeExecutionPattern', () => {
  test('returns true for callable code execution and host escape APIs', () => {
    expect(isCodeExecutionPattern('setTimeout')).toBe(true);
    expect(isCodeExecutionPattern('eval')).toBe(true);
    expect(isCodeExecutionPattern('AsyncFunction')).toBe(true);
    expect(isCodeExecutionPattern('execFile')).toBe(true);
    expect(isCodeExecutionPattern('importScripts')).toBe(true);
    expect(isCodeExecutionPattern('Worker')).toBe(true);
  });

  test('returns false for object intrinsics and normal methods', () => {
    expect(isCodeExecutionPattern('toString')).toBe(false);
    expect(isCodeExecutionPattern('map')).toBe(false);
  });
});

describe('getBlockedKeyCategory', () => {
  test('returns the matching sandbox category', () => {
    expect(getBlockedKeyCategory('__proto__')).toBe('object_intrinsic');
    expect(getBlockedKeyCategory('eval')).toBe('universal_global');
    expect(getBlockedKeyCategory('process', 'node')).toBe('node_global');
    expect(getBlockedKeyCategory('document', 'browser')).toBe('browser_global');
    expect(getBlockedKeyCategory('Deno', 'deno')).toBe('deno_global');
  });

  test('returns null when a key is outside the requested environment', () => {
    expect(getBlockedKeyCategory('document', 'node')).toBe(null);
    expect(getBlockedKeyCategory('process', 'browser')).toBe(null);
    expect(getBlockedKeyCategory('name')).toBe(null);
  });
});

describe('BLOCKED_KEY_CATEGORIES', () => {
  test('keeps JS/TS sandbox groups explicit', () => {
    expect(BLOCKED_KEY_CATEGORIES.OBJECT_INTRINSICS).toContain('__defineGetter__');
    expect(BLOCKED_KEY_CATEGORIES.UNIVERSAL_GLOBALS).toContain('globalThis');
    expect(BLOCKED_KEY_CATEGORIES.NODE_GLOBALS).toContain('require');
    expect(BLOCKED_KEY_CATEGORIES.BROWSER_GLOBALS).toContain('document');
    expect(BLOCKED_KEY_CATEGORIES.DENO_GLOBALS).toContain('Deno');
    expect(BLOCKED_KEY_CATEGORIES.CODE_EXECUTION).toContain('setTimeout');
  });
});

describe('BLOCKED_KEYS_LIST', () => {
  test('contains expected keys', () => {
    expect(BLOCKED_KEYS_LIST).toContain('__proto__');
    expect(BLOCKED_KEYS_LIST).toContain('constructor');
    expect(BLOCKED_KEYS_LIST).toContain('prototype');
    expect(BLOCKED_KEYS_LIST).toContain('document');
    expect(BLOCKED_KEYS_LIST).toContain('Deno');
  });
});

describe('DANGEROUS_GLOBALS_LIST', () => {
  test('contains expected globals', () => {
    expect(DANGEROUS_GLOBALS_LIST).toContain('global');
    expect(DANGEROUS_GLOBALS_LIST).toContain('window');
    expect(DANGEROUS_GLOBALS_LIST).toContain('process');
  });
});
