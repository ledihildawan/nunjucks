import { describe, test, expect } from 'bun:test';
import {
  isBlockedKey,
  isDangerousGlobal,
  isCodeExecutionPattern,
  getBlockedKeyCategory,
  BLOCKED_KEYS_LIST,
  DANGEROUS_GLOBALS_LIST,
  ENVIRONMENTS,
} from './blocked-keys.ts';

describe('isBlockedKey', () => {
  test('blocks object intrinsics', () => {
    expect(isBlockedKey('__proto__')).toBe(true);
    expect(isBlockedKey('constructor')).toBe(true);
    expect(isBlockedKey('prototype')).toBe(true);
    expect(isBlockedKey('hasOwnProperty')).toBe(true);
    expect(isBlockedKey('valueOf')).toBe(true);
  });

  test('blocks universal globals in all envs', () => {
    expect(isBlockedKey('eval')).toBe(true);
    expect(isBlockedKey('Function')).toBe(true);
    expect(isBlockedKey('globalThis')).toBe(true);
  });

  test('env-specific: node globals', () => {
    expect(isBlockedKey('process', 'node')).toBe(true);
    expect(isBlockedKey('require', 'node')).toBe(true);
    expect(isBlockedKey('process', 'browser')).toBe(false);
  });

  test('env-specific: browser globals', () => {
    expect(isBlockedKey('window', 'browser')).toBe(true);
    expect(isBlockedKey('document', 'browser')).toBe(true);
    expect(isBlockedKey('window', 'node')).toBe(false);
  });

  test('env-specific: deno globals', () => {
    expect(isBlockedKey('Deno', 'deno')).toBe(true);
    expect(isBlockedKey('Deno', 'node')).toBe(false);
  });

  test('auto env blocks everything', () => {
    expect(isBlockedKey('process')).toBe(true);
    expect(isBlockedKey('window')).toBe(true);
    expect(isBlockedKey('Deno')).toBe(true);
  });

  test('allows normal variable names', () => {
    expect(isBlockedKey('userName')).toBe(false);
    expect(isBlockedKey('items')).toBe(false);
    expect(isBlockedKey('data')).toBe(false);
  });
});

describe('isDangerousGlobal', () => {
  test('detects dangerous globals', () => {
    expect(isDangerousGlobal('eval')).toBe(true);
    expect(isDangerousGlobal('Function')).toBe(true);
    expect(isDangerousGlobal('process')).toBe(true);
    expect(isDangerousGlobal('require')).toBe(true);
  });

  test('does not flag object intrinsics', () => {
    expect(isDangerousGlobal('constructor')).toBe(false);
    expect(isDangerousGlobal('__proto__')).toBe(false);
  });

  test('allows normal names', () => {
    expect(isDangerousGlobal('myVar')).toBe(false);
  });
});

describe('isCodeExecutionPattern', () => {
  test('detects code execution patterns', () => {
    expect(isCodeExecutionPattern('eval')).toBe(true);
    expect(isCodeExecutionPattern('Function')).toBe(true);
    expect(isCodeExecutionPattern('setTimeout')).toBe(true);
    expect(isCodeExecutionPattern('exec')).toBe(true);
    expect(isCodeExecutionPattern('spawn')).toBe(true);
  });

  test('allows normal function names', () => {
    expect(isCodeExecutionPattern('myFunc')).toBe(false);
    expect(isCodeExecutionPattern('render')).toBe(false);
  });
});

describe('getBlockedKeyCategory', () => {
  test('categorizes object intrinsics', () => {
    expect(getBlockedKeyCategory('__proto__')).toBe('object_intrinsic');
    expect(getBlockedKeyCategory('toString')).toBe('object_intrinsic');
  });

  test('categorizes universal globals', () => {
    expect(getBlockedKeyCategory('eval')).toBe('universal_global');
    expect(getBlockedKeyCategory('globalThis')).toBe('universal_global');
  });

  test('categorizes env-specific globals', () => {
    expect(getBlockedKeyCategory('process', 'node')).toBe('node_global');
    expect(getBlockedKeyCategory('window', 'browser')).toBe('browser_global');
    expect(getBlockedKeyCategory('Deno', 'deno')).toBe('deno_global');
  });

  test('returns null for unknown keys', () => {
    expect(getBlockedKeyCategory('myVar')).toBe(null);
  });
});

describe('exported lists', () => {
  test('BLOCKED_KEYS_LIST is non-empty array', () => {
    expect(Array.isArray(BLOCKED_KEYS_LIST)).toBe(true);
    expect(BLOCKED_KEYS_LIST.length).toBeGreaterThan(10);
    expect(BLOCKED_KEYS_LIST).toContain('__proto__');
  });

  test('DANGEROUS_GLOBALS_LIST is non-empty array', () => {
    expect(Array.isArray(DANGEROUS_GLOBALS_LIST)).toBe(true);
    expect(DANGEROUS_GLOBALS_LIST).toContain('eval');
  });

  test('ENVIRONMENTS constants', () => {
    expect(ENVIRONMENTS.NODE).toBe('node');
    expect(ENVIRONMENTS.BROWSER).toBe('browser');
    expect(ENVIRONMENTS.DENO).toBe('deno');
  });
});
