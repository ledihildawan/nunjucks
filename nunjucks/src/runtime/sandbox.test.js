import { describe, test, expect } from 'bun:test';
import {
  isBlockedKey,
  isDangerousGlobal,
  createSandboxedObject,
  createSandboxedContext,
  wrapMemberAccess,
  BLOCKED_KEYS_LIST,
  DANGEROUS_GLOBALS_LIST,
} from './sandbox.js';

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

describe('createSandboxedObject', () => {
  test('returns original object when sandbox disabled', () => {
    const obj = { name: 'test' };
    const result = createSandboxedObject(obj, false);
    expect(result).toBe(obj);
  });

  test('blocks access to __proto__', () => {
    const obj = { name: 'test' };
    const sandboxed = createSandboxedObject(obj, true);
    expect(() => sandboxed.__proto__).toThrow();
  });

  test('blocks access to constructor', () => {
    const obj = { name: 'test' };
    const sandboxed = createSandboxedObject(obj, true);
    expect(() => sandboxed.constructor).toThrow();
  });

  test('allows normal property access', () => {
    const obj = { name: 'test' };
    const sandboxed = createSandboxedObject(obj, true);
    expect(sandboxed.name).toBe('test');
  });

  test('blocks setting blocked keys', () => {
    const obj = { name: 'test' };
    const sandboxed = createSandboxedObject(obj, true);
    expect(() => { sandboxed.__proto__ = {}; }).toThrow();
  });

  test('allows setting normal keys', () => {
    const obj = { name: 'test' };
    const sandboxed = createSandboxedObject(obj, true);
    sandboxed.newProp = 'value';
    expect(sandboxed.newProp).toBe('value');
  });

  test('handles nested objects', () => {
    const obj = { user: { name: 'test' } };
    const sandboxed = createSandboxedObject(obj, true);
    expect(sandboxed.user.name).toBe('test');
    expect(() => sandboxed.user.__proto__).toThrow();
  });

  test('handles null', () => {
    expect(createSandboxedObject(null, true)).toBe(null);
  });

  test('handles undefined', () => {
    expect(createSandboxedObject(undefined, true)).toBe(undefined);
  });

  test('handles primitives', () => {
    expect(createSandboxedObject('string', true)).toBe('string');
    expect(createSandboxedObject(42, true)).toBe(42);
    expect(createSandboxedObject(true, true)).toBe(true);
  });

  test('wraps functions', () => {
    const obj = { fn: () => 'called' };
    const sandboxed = createSandboxedObject(obj, true);
    expect(typeof sandboxed.fn).toBe('function');
    expect(sandboxed.fn()).toBe('called');
  });
});

describe('createSandboxedContext', () => {
  test('returns original context when sandbox disabled', () => {
    const ctx = { name: 'test' };
    const result = createSandboxedContext(ctx, false);
    expect(result).toBe(ctx);
  });

  test('sandbox all top-level properties', () => {
    const ctx = { user: { name: 'test' }, count: 5 };
    const sandboxed = createSandboxedContext(ctx, true);
    expect(sandboxed.count).toBe(5);
    expect(sandboxed.user.name).toBe('test');
    expect(() => sandboxed.user.__proto__).toThrow();
  });

  test('handles empty context', () => {
    expect(createSandboxedContext({}, true)).toEqual({});
    expect(createSandboxedContext(null, true)).toBe(null);
    expect(createSandboxedContext(undefined, true)).toBe(undefined);
  });
});

describe('wrapMemberAccess', () => {
  test('returns value when sandbox disabled', () => {
    const obj = { name: 'test' };
    expect(wrapMemberAccess(obj, 'name', false)).toBe('test');
  });

  test('blocks access to blocked keys', () => {
    const obj = { name: 'test' };
    expect(() => wrapMemberAccess(obj, '__proto__', true)).toThrow();
  });

  test('allows access to normal keys', () => {
    const obj = { name: 'test' };
    expect(wrapMemberAccess(obj, 'name', true)).toBe('test');
  });

  test('handles null/undefined target', () => {
    expect(wrapMemberAccess(null, 'name', true)).toBe(undefined);
    expect(wrapMemberAccess(undefined, 'name', true)).toBe(undefined);
  });

  test('wraps functions in object', () => {
    const obj = { fn: () => 'called' };
    const result = wrapMemberAccess(obj, 'fn', true);
    expect(typeof result).toBe('function');
    expect(result()).toBe('called');
  });

  test('handles nested dangerous keys', () => {
    const obj = { user: { name: 'test' } };
    const sandboxed = wrapMemberAccess(obj, 'user', true);
    expect(() => sandboxed.__proto__).toThrow();
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
