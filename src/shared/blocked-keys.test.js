import { describe, test, expect } from 'bun:test';
import {
  isBlockedKey,
  isDangerousGlobal,
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
  });

  test('returns false for normal keys', () => {
    expect(isBlockedKey('name')).toBe(false);
    expect(isBlockedKey('value')).toBe(false);
    expect(isBlockedKey('user')).toBe(false);
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
  });

  test('returns false for normal globals', () => {
    expect(isDangerousGlobal('console')).toBe(false);
    expect(isDangerousGlobal('Array')).toBe(false);
  });
});

describe('BLOCKED_KEYS_LIST', () => {
  test('contains expected keys', () => {
    expect(BLOCKED_KEYS_LIST).toContain('__proto__');
    expect(BLOCKED_KEYS_LIST).toContain('constructor');
    expect(BLOCKED_KEYS_LIST).toContain('prototype');
  });
});

describe('DANGEROUS_GLOBALS_LIST', () => {
  test('contains expected globals', () => {
    expect(DANGEROUS_GLOBALS_LIST).toContain('global');
    expect(DANGEROUS_GLOBALS_LIST).toContain('window');
    expect(DANGEROUS_GLOBALS_LIST).toContain('process');
  });
});
