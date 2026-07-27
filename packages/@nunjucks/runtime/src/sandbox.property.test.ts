import { describe, test, expect } from 'bun:test';
import {
  createSandboxedObject,
  createSandboxedContext,
  wrapMemberAccess,
  isCodeExecutionPattern,
} from '@nunjucks/runtime/sandbox';
import { validateContextKeys } from '@nunjucks/runtime/security';

describe('Sandbox Property-Based Tests', () => {
  describe('OBJECT_INTRINSICS own properties are blocked', () => {
    test('__proto__ as own property is blocked', () => {
      const obj = { __proto__: 'blocked', safe: 'value' };
      const sandboxed = createSandboxedObject(obj, true) as Record<string, unknown>;
      expect(() => (sandboxed as any).__proto__).toThrow();
      expect(sandboxed.safe).toBe('value');
    });

    test('constructor as own property is blocked', () => {
      const obj = { constructor: 'blocked', safe: 'value' };
      const sandboxed = createSandboxedObject(obj, true) as Record<string, unknown>;
      expect(() => (sandboxed as any).constructor).toThrow();
      expect(sandboxed.safe).toBe('value');
    });

    test('prototype as own property is blocked', () => {
      const obj = { prototype: 'blocked', safe: 'value' };
      const sandboxed = createSandboxedObject(obj, true) as Record<string, unknown>;
      expect(() => (sandboxed as any).prototype).toThrow();
      expect(sandboxed.safe).toBe('value');
    });

    test('all dangerous OBJECT_INTRINSICS as own properties are blocked', () => {
      const dangerousOwnProps = ['__proto__', 'constructor', 'prototype'];
      for (const key of dangerousOwnProps) {
        const obj = { [key]: 'blocked', safeKey: 'visible' };
        const sandboxed = createSandboxedObject(obj, true) as Record<string, unknown>;
        expect(() => (sandboxed as any)[key]).toThrow();
        expect(sandboxed.safeKey).toBe('visible');
      }
    });

    test('inherited toString is NOT returned (returns undefined)', () => {
      const obj = { safe: 'value' };
      const sandboxed = createSandboxedObject(obj, true) as Record<string, unknown>;
      const result = (sandboxed as any).toString;
      expect(result).toBeUndefined();
    });
  });

  describe('Code execution functions are blocked', () => {
    test('setTimeout with string code throws', () => {
      const obj = { setTimeout: () => 'scheduled' };
      const sandboxed = createSandboxedObject(obj, true) as { setTimeout: (...args: unknown[]) => unknown };
      expect(() => sandboxed.setTimeout('alert(1)', 0)).toThrow();
    });

    test('setInterval with string code throws', () => {
      const obj = { setInterval: () => 'scheduled' };
      const sandboxed = createSandboxedObject(obj, true) as { setInterval: (...args: unknown[]) => unknown };
      expect(() => sandboxed.setInterval('alert(1)', 0)).toThrow();
    });

    test('all CODE_EXECUTION patterns are detected', () => {
      const codeExecPatterns = ['eval', 'Function', 'AsyncFunction', 'GeneratorFunction',
        'AsyncGeneratorFunction', 'setTimeout', 'setInterval', 'setImmediate',
        'requestAnimationFrame', 'queueMicrotask', 'exec', 'execFile', 'execSync',
        'spawn', 'spawnSync', 'fork', 'import', 'importScripts', 'fetch',
        'XMLHttpRequest', 'WebSocket', 'Worker', 'SharedWorker', 'WebAssembly'];
      for (const key of codeExecPatterns) {
        expect(isCodeExecutionPattern(key)).toBe(true);
      }
    });

    test('safe functions are not detected as code execution', () => {
      const safeKeys = ['map', 'filter', 'reduce', 'slice', 'forEach', 'find', 'some', 'every', 'includes'];
      for (const key of safeKeys) {
        expect(isCodeExecutionPattern(key)).toBe(false);
      }
    });
  });

  describe('Prototype pollution is blocked', () => {
    test('__proto__ setting throws', () => {
      const obj = { safe: 'value' };
      const sandboxed = createSandboxedObject(obj, true) as Record<string, unknown>;
      expect(() => { (sandboxed as any).__proto__ = {}; }).toThrow();
    });

    test('constructor setting throws', () => {
      const obj = { safe: 'value' };
      const sandboxed = createSandboxedObject(obj, true) as Record<string, unknown>;
      expect(() => { (sandboxed as any).constructor = {}; }).toThrow();
    });

    test('prototype setting throws', () => {
      const obj = { safe: 'value' };
      const sandboxed = createSandboxedObject(obj, true) as Record<string, unknown>;
      expect(() => { (sandboxed as any).prototype = {}; }).toThrow();
    });

    test('nested prototype pollution is blocked', () => {
      const inner = { data: 'secret' };
      const outer = { inner };
      const sandboxed = createSandboxedObject(outer, true) as Record<string, unknown>;
      const innerSandboxed = sandboxed.inner as Record<string, unknown>;
      expect(() => (innerSandboxed as any).__proto__).toThrow();
    });
  });

  describe('Symbol access control', () => {
    test('Symbol.toStringTag is allowed', () => {
      const tag = Symbol.toStringTag;
      const obj = { [tag]: 'SafeThing', name: 'visible' };
      const sandboxed = createSandboxedObject(obj, true) as Record<string | symbol, unknown>;
      expect(sandboxed[tag]).toBe('SafeThing');
      expect(sandboxed.name).toBe('visible');
    });

    test('unsafe symbol descriptions are blocked', () => {
      const unsafeSymbols = [
        Symbol('constructor'),
        Symbol('prototype'),
        Symbol('__proto__'),
      ];
      for (const sym of unsafeSymbols) {
        const obj = { [sym]: 'dangerous', safe: 'ok' };
        const sandboxed = createSandboxedObject(obj, true) as Record<string | symbol, unknown>;
        expect(() => (sandboxed as any)[sym]).toThrow();
      }
    });

    test('anonymous symbols are blocked', () => {
      // biome-ignore lint/style/useSymbolDescription: the symbol being anonymous is precisely what this test exercises.
      const anonSym = Symbol();
      const obj = { [anonSym]: 'dangerous' };
      const sandboxed = createSandboxedObject(obj, true) as Record<string | symbol, unknown>;
      expect(() => (sandboxed as any)[anonSym]).toThrow();
    });
  });

  describe('Nested objects maintain isolation', () => {
    test('nested objects are also sandboxed', () => {
      const inner = { dangerous: 'hidden', safe: 'visible' };
      const outer = { inner, topLevelSafe: 'ok' };
      const sandboxed = createSandboxedObject(outer, true) as Record<string, unknown>;
      const innerSandboxed = sandboxed.inner as Record<string, unknown>;
      expect(() => (innerSandboxed as any).__proto__).toThrow();
      expect(innerSandboxed.safe).toBe('visible');
    });

    test('deeply nested objects maintain sandbox', () => {
      const level3 = { key: 'secret' };
      const level2 = { level3 };
      const level1 = { level2 };
      const sandboxed = createSandboxedObject(level1, true) as Record<string, unknown>;
      const l2 = (sandboxed.level2 as Record<string, unknown>);
      const l3 = (l2.level3 as Record<string, unknown>);
      expect(() => (l3 as any).__proto__).toThrow();
    });

    test('functions in nested objects are wrapped', () => {
      const inner = {
        setTimeout: () => 'scheduled',
        safeFunc: () => 'safe'
      };
      const outer = { inner };
      const sandboxed = createSandboxedObject(outer, true) as Record<string, unknown>;
      const innerSandboxed = sandboxed.inner as { setTimeout: (...args: unknown[]) => unknown };
      expect(() => innerSandboxed.setTimeout('alert(1)', 0)).toThrow();
    });
  });

  describe('Context boundary security', () => {
    test('createSandboxedContext blocks universal globals at top level', () => {
      const context = {
        eval: 'dangerous',
        Function: 'dangerous',
        Proxy: 'dangerous',
        safeKey: 'ok'
      };
      const sandboxed = createSandboxedContext(context, true) as Record<string, unknown>;
      expect(() => (sandboxed as any).eval).toThrow();
      expect(() => (sandboxed as any).Function).toThrow();
      expect(() => (sandboxed as any).Proxy).toThrow();
      expect(sandboxed.safeKey).toBe('ok');
    });

    test('createSandboxedContext blocks NODE_GLOBALS in node env', () => {
      const context = {
        process: 'dangerous',
        require: 'dangerous',
        global: 'dangerous',
        safeKey: 'ok'
      };
      const sandboxed = createSandboxedContext(context, true, { environment: 'node' }) as Record<string, unknown>;
      expect(() => (sandboxed as any).process).toThrow();
      expect(() => (sandboxed as any).require).toThrow();
      expect(() => (sandboxed as any).global).toThrow();
      expect(sandboxed.safeKey).toBe('ok');
    });

    test('createSandboxedContext blocks BROWSER_GLOBALS in browser env', () => {
      const context = {
        fetch: 'dangerous',
        XMLHttpRequest: 'dangerous',
        WebSocket: 'dangerous',
        safeKey: 'ok'
      };
      const sandboxed = createSandboxedContext(context, true, { environment: 'browser' }) as Record<string, unknown>;
      expect(() => (sandboxed as any).fetch).toThrow();
      expect(() => (sandboxed as any).XMLHttpRequest).toThrow();
      expect(() => (sandboxed as any).WebSocket).toThrow();
      expect(sandboxed.safeKey).toBe('ok');
    });

    test('validateContextKeys detects blocked keys', () => {
      const context = {
        __proto__: 'blocked',
        constructor: 'blocked',
        process: 'blocked',
        safeKey: 'ok'
      };
      const result = validateContextKeys(context);
      expect(result.valid).toBe(false);
      expect(result.blocked.length).toBeGreaterThan(0);
    });
  });

  describe('wrapMemberAccess security', () => {
    test('blocks access to own OBJECT_INTRINSICS', () => {
      const target = { __proto__: 'blocked', safe: 'ok' };
      expect(() => wrapMemberAccess(target, '__proto__', true, {})).toThrow();
      expect(target.safe).toBe('ok');
    });

    test('blocks code execution patterns in function arguments', () => {
      const target = { setTimeout: () => 'result' };
      const wrapped = wrapMemberAccess(target, 'setTimeout', true, {}) as { setTimeout: (...args: unknown[]) => unknown };
      expect(() => wrapped.setTimeout('alert(1)', 0)).toThrow();
    });
  });

  describe('Edge cases', () => {
    test('empty objects are handled', () => {
      const obj = {};
      const sandboxed = createSandboxedObject(obj, true);
      expect(sandboxed).toEqual({});
    });

    test('null and undefined are passed through', () => {
      expect(createSandboxedObject(null, true)).toBe(null);
      expect(createSandboxedObject(undefined, true)).toBe(undefined);
    });

    test('primitives are passed through', () => {
      expect(createSandboxedObject('string', true)).toBe('string');
      expect(createSandboxedObject(42, true)).toBe(42);
      expect(createSandboxedObject(true, true)).toBe(true);
    });

    test('accessing non-existent keys returns undefined', () => {
      const obj = { existing: 'value' };
      const sandboxed = createSandboxedObject(obj, true) as Record<string, unknown>;
      expect((sandboxed as any).nonExistent).toBeUndefined();
    });

    test('has operator works correctly', () => {
      const obj = { existing: 'value', __proto__: 'blocked' };
      const sandboxed = createSandboxedObject(obj, true) as Record<string, unknown>;
      expect('existing' in sandboxed).toBe(true);
      expect('nonExistent' in sandboxed).toBe(false);
    });
  });
});