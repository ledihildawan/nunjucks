import { describe, test, expect } from 'bun:test';
import {
  createSandboxedObject,
  createSandboxedContext,
  wrapMemberAccess,
  isAllowedKey,
  isBlockedKey,
  isCodeExecutionPattern,
} from './sandbox.js';

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

describe('isAllowedKey', () => {
  test('returns true when no allowlist', () => {
    expect(isAllowedKey('any', null)).toBe(true);
    expect(isAllowedKey('any', undefined)).toBe(true);
    expect(isAllowedKey('any', [])).toBe(true);
  });

  test('returns true when key is in allowlist', () => {
    expect(isAllowedKey('user', ['user', 'name'])).toBe(true);
  });

  test('returns false when key is not in allowlist', () => {
    expect(isAllowedKey('admin', ['user', 'name'])).toBe(false);
  });
});

describe('isBlockedKey', () => {
  test('blocks common dangerous keys', () => {
    expect(isBlockedKey('__proto__')).toBe(true);
    expect(isBlockedKey('constructor')).toBe(true);
    expect(isBlockedKey('prototype')).toBe(true);
    expect(isBlockedKey('eval')).toBe(true);
    expect(isBlockedKey('Function')).toBe(true);
  });

  test('allows normal keys', () => {
    expect(isBlockedKey('name')).toBe(false);
    expect(isBlockedKey('user')).toBe(false);
    expect(isBlockedKey('data')).toBe(false);
  });

  test('supports environment-specific blocking', () => {
    expect(isBlockedKey('process', 'node')).toBe(true);
    expect(isBlockedKey('window', 'browser')).toBe(true);
    expect(isBlockedKey('Deno', 'deno')).toBe(true);
  });
});

describe('isCodeExecutionPattern', () => {
  test('detects timing functions', () => {
    expect(isCodeExecutionPattern('setTimeout')).toBe(true);
    expect(isCodeExecutionPattern('setInterval')).toBe(true);
    expect(isCodeExecutionPattern('setImmediate')).toBe(true);
    expect(isCodeExecutionPattern('requestAnimationFrame')).toBe(true);
  });

  test('detects code execution functions', () => {
    expect(isCodeExecutionPattern('eval')).toBe(true);
    expect(isCodeExecutionPattern('Function')).toBe(true);
    expect(isCodeExecutionPattern('exec')).toBe(true);
    expect(isCodeExecutionPattern('execSync')).toBe(true);
    expect(isCodeExecutionPattern('spawn')).toBe(true);
    expect(isCodeExecutionPattern('spawnSync')).toBe(true);
  });

  test('detects network functions', () => {
    expect(isCodeExecutionPattern('fetch')).toBe(true);
    expect(isCodeExecutionPattern('XMLHttpRequest')).toBe(true);
  });

  test('returns false for safe functions', () => {
    expect(isCodeExecutionPattern('map')).toBe(false);
    expect(isCodeExecutionPattern('filter')).toBe(false);
    expect(isCodeExecutionPattern('toString')).toBe(false);
  });
});

describe('Allowlist Mode', () => {
  test('createSandboxedObject allows blocklist-only mode by default', () => {
    const obj = { user: 'john', admin: 'secret' };
    const sandboxed = createSandboxedObject(obj, true, { allowlist: [], blocklistMode: true });
    expect(sandboxed.user).toBe('john');
    expect(sandboxed.admin).toBe('secret');
  });

  test('createSandboxedObject blocks non-allowlisted keys in allowlist mode', () => {
    const obj = { user: 'john', admin: 'secret', password: '123' };
    const sandboxed = createSandboxedObject(obj, true, { allowlist: ['user'], blocklistMode: false });
    expect(sandboxed.user).toBe('john');
    expect(() => sandboxed.admin).toThrow();
    expect(() => sandboxed.password).toThrow();
  });

  test('createSandboxedContext blocks non-allowlisted keys in allowlist mode', () => {
    const ctx = { user: 'john', admin: 'secret' };
    const sandboxed = createSandboxedContext(ctx, true, { allowlist: ['user'], blocklistMode: false });
    expect(sandboxed.user).toBe('john');
    expect(() => sandboxed.admin).toThrow();
  });

  test('wrapMemberAccess supports allowlist mode', () => {
    const obj = { user: 'john', admin: 'secret' };
    expect(wrapMemberAccess(obj, 'user', true, { allowlist: ['user'], blocklistMode: false })).toBe('john');
    expect(() => wrapMemberAccess(obj, 'admin', true, { allowlist: ['user'], blocklistMode: false })).toThrow();
  });

  test('nested objects inherit allowlist options', () => {
    const obj = { user: { name: 'john', password: '123' } };
    const sandboxed = createSandboxedObject(obj, true, { allowlist: ['user', 'name'], blocklistMode: false });
    expect(sandboxed.user.name).toBe('john');
    expect(() => sandboxed.user.password).toThrow();
  });
});

describe('Environment-Aware Blocking', () => {
  test('Node.js specific keys blocked in node env', () => {
    expect(isBlockedKey('process', 'node')).toBe(true);
    expect(isBlockedKey('require', 'node')).toBe(true);
    expect(isBlockedKey('module', 'node')).toBe(true);
    expect(isBlockedKey('__dirname', 'node')).toBe(true);
  });

  test('Browser specific keys blocked in browser env', () => {
    expect(isBlockedKey('window', 'browser')).toBe(true);
    expect(isBlockedKey('document', 'browser')).toBe(true);
    expect(isBlockedKey('localStorage', 'browser')).toBe(true);
    expect(isBlockedKey('sessionStorage', 'browser')).toBe(true);
    expect(isBlockedKey('fetch', 'browser')).toBe(true);
  });

  test('Deno specific keys blocked in deno env', () => {
    expect(isBlockedKey('Deno', 'deno')).toBe(true);
    expect(isBlockedKey('process', 'deno')).toBe(true);
  });

  test('common keys blocked in all environments', () => {
    expect(isBlockedKey('__proto__', 'node')).toBe(true);
    expect(isBlockedKey('__proto__', 'browser')).toBe(true);
    expect(isBlockedKey('__proto__', 'deno')).toBe(true);
    expect(isBlockedKey('constructor', 'node')).toBe(true);
    expect(isBlockedKey('eval', 'browser')).toBe(true);
  });
});
