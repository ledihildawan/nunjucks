import { describe, test, expect } from 'bun:test';
import {
  createSandboxedObject,
  createSandboxedContext,
  wrapMemberAccess,
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
