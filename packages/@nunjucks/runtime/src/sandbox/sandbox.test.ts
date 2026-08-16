import { describe, expect, test } from 'bun:test';
import { isBlockedKey, isCodeExecutionPattern } from '@nunjucks/shared';
import { isPropertyNotFoundResult } from '../member-access.ts';
import {
  createSandboxedContext,
  createSandboxedObject,
  isAllowedKey,
  wrapMemberAccess,
} from './index.ts';

describe('createSandboxedObject', () => {
  test('returns original object when sandbox disabled', () => {
    const obj = { name: 'test' };
    const result = createSandboxedObject({ value: obj, sandboxEnabled: false });
    expect(result).toBe(obj);
  });

  test('blocks access to __proto__', () => {
    const obj = { name: 'test' };
    const sandboxed = createSandboxedObject({ value: obj, sandboxEnabled: true }) as Record<
      string,
      unknown
    >;
    expect(() => sandboxed.__proto__).toThrow();
  });

  test('blocks access to constructor', () => {
    const obj = { name: 'test' };
    const sandboxed = createSandboxedObject({ value: obj, sandboxEnabled: true }) as Record<
      string,
      unknown
    >;
    expect(() => sandboxed.constructor).toThrow();
  });

  test('allows normal property access', () => {
    const obj = { name: 'test' };
    const sandboxed = createSandboxedObject({ value: obj, sandboxEnabled: true }) as Record<
      string,
      unknown
    >;
    expect(sandboxed.name).toBe('test');
  });

  test('blocks setting blocked keys', () => {
    const obj = { name: 'test' };
    const sandboxed = createSandboxedObject({ value: obj, sandboxEnabled: true }) as Record<
      string,
      unknown
    >;
    expect(() => {
      sandboxed.__proto__ = {};
    }).toThrow();
  });

  test('allows setting normal keys', () => {
    const obj = { name: 'test' };
    const sandboxed = createSandboxedObject({ value: obj, sandboxEnabled: true }) as Record<
      string,
      unknown
    >;
    sandboxed.newProp = 'value';
    expect(sandboxed.newProp).toBe('value');
  });

  test('handles nested objects', () => {
    const obj = { user: { name: 'test' } };
    const sandboxed = createSandboxedObject({ value: obj, sandboxEnabled: true }) as {
      user: Record<string, unknown>;
    };
    expect(sandboxed.user.name).toBe('test');
    expect(() => sandboxed.user.__proto__).toThrow();
  });

  test('allows nested data keys that only look like globals', () => {
    const obj = { user: { eval: 'label', global: 'team', process: 'workflow' } };
    const sandboxed = createSandboxedObject({ value: obj, sandboxEnabled: true }) as {
      user: Record<string, unknown>;
    };

    expect(sandboxed.user.eval).toBe('label');
    expect(sandboxed.user.global).toBe('team');
    expect(sandboxed.user.process).toBe('workflow');
  });

  test('does not expose inherited properties as sandbox data', () => {
    const parent = { inheritedSecret: 'hidden' };
    const obj = Object.create(parent);
    obj.name = 'visible';
    const sandboxed = createSandboxedObject({ value: obj, sandboxEnabled: true }) as Record<
      string,
      unknown
    >;

    expect(sandboxed.name).toBe('visible');
    expect(sandboxed.inheritedSecret).toBeUndefined();
    expect('inheritedSecret' in sandboxed).toBe(false);
  });

  test('does not treat symbol access as string key escape', () => {
    const tag = Symbol.toStringTag;
    const obj = { [tag]: 'SafeThing', name: 'visible' };
    const sandboxed = createSandboxedObject({ value: obj, sandboxEnabled: true }) as Record<
      string | symbol,
      unknown
    >;

    expect(sandboxed[tag]).toBe('SafeThing');
    expect(sandboxed.name).toBe('visible');
  });

  test('handles null', () => {
    expect(createSandboxedObject({ value: null, sandboxEnabled: true })).toBe(null);
  });

  test('handles undefined', () => {
    expect(createSandboxedObject({ value: undefined, sandboxEnabled: true })).toBe(undefined);
  });

  test('handles primitives', () => {
    expect(createSandboxedObject({ value: 'string', sandboxEnabled: true })).toBe('string');
    expect(createSandboxedObject({ value: 42, sandboxEnabled: true })).toBe(42);
    expect(createSandboxedObject({ value: true, sandboxEnabled: true })).toBe(true);
  });

  test('wraps functions', () => {
    const obj = { fn: () => 'called' };
    const sandboxed = createSandboxedObject({ value: obj, sandboxEnabled: true }) as {
      fn: () => string;
    };
    expect(typeof sandboxed.fn).toBe('function');
    expect(sandboxed.fn()).toBe('called');
  });

  test('blocks string code execution in sandboxed functions', () => {
    const obj = { setTimeout: () => 'scheduled' };
    const sandboxed = createSandboxedObject({ value: obj, sandboxEnabled: true }) as {
      setTimeout: (...args: unknown[]) => unknown;
    };

    try {
      sandboxed.setTimeout('alert(1)', 0);
    } catch (e) {
      expect((e as { code: string }).code).toBe('SANDBOX_CODE_EXECUTION');
      return;
    }

    throw new Error('Expected sandboxed function to throw');
  });
});

describe('createSandboxedContext', () => {
  test('returns original context when sandbox disabled', () => {
    const ctx = { name: 'test' };
    const result = createSandboxedContext({ context: ctx, sandboxEnabled: false });
    expect(result).toBe(ctx);
  });

  test('sandbox all top-level properties', () => {
    const ctx = { user: { name: 'test' }, count: 5 };
    const sandboxed = createSandboxedContext({ context: ctx, sandboxEnabled: true }) as {
      count: number;
      user: Record<string, unknown>;
    };
    expect(sandboxed.count).toBe(5);
    expect(sandboxed.user.name).toBe('test');
    expect(() => sandboxed.user.__proto__).toThrow();
  });

  test('blocks global-like names only at the top-level context boundary', () => {
    const ctx = { user: { eval: 'profile label', global: 'account' }, eval: 'global collision' };
    const sandboxed = createSandboxedContext({ context: ctx, sandboxEnabled: true }) as {
      user: Record<string, unknown>;
      eval: unknown;
    };

    expect(sandboxed.user.eval).toBe('profile label');
    expect(sandboxed.user.global).toBe('account');
    expect(() => sandboxed.eval).toThrow();
  });

  test('blocks direct context mutation in sandbox mode', () => {
    const ctx = { user: 'john' };
    const sandboxed = createSandboxedContext({ context: ctx, sandboxEnabled: true }) as {
      user: string;
    };

    try {
      sandboxed.user = 'jane';
    } catch (e) {
      expect((e as { code: string }).code).toBe('SANDBOX_CONTEXT_MODIFY');
      return;
    }

    throw new Error('Expected sandboxed context mutation to throw');
  });

  test('allows internal runtime metadata on sandboxed context', () => {
    const sandboxed = createSandboxedContext({ context: {}, sandboxEnabled: true }) as Record<
      string,
      unknown
    >;

    sandboxed.__nunjucks_undefined_mode = 'strict';

    expect(sandboxed.__nunjucks_undefined_mode).toBe('strict');
  });

  test('handles empty context', () => {
    expect(createSandboxedContext({ context: {}, sandboxEnabled: true })).toEqual({});
    expect(createSandboxedContext({ context: null, sandboxEnabled: true })).toBe(null);
    expect(createSandboxedContext({ context: undefined, sandboxEnabled: true })).toBe(undefined);
  });
});

describe('wrapMemberAccess', () => {
  test('returns value when sandbox disabled', () => {
    const obj = { name: 'test' };
    expect(wrapMemberAccess({ target: obj, value: 'name', sandboxEnabled: false })).toBe('test');
  });

  test('blocks access to blocked keys', () => {
    const obj = { name: 'test' };
    expect(() =>
      wrapMemberAccess({ target: obj, value: '__proto__', sandboxEnabled: true })
    ).toThrow();
  });

  test('allows member access for nested global-like data keys', () => {
    const obj = { eval: 'label', global: 'team' };

    expect(wrapMemberAccess({ target: obj, value: 'eval', sandboxEnabled: true })).toBe('label');
    expect(wrapMemberAccess({ target: obj, value: 'global', sandboxEnabled: true })).toBe('team');
  });

  test('allows access to normal keys', () => {
    const obj = { name: 'test' };
    expect(wrapMemberAccess({ target: obj, value: 'name', sandboxEnabled: true })).toBe('test');
  });

  test('handles null/undefined target', () => {
    const nullResult = wrapMemberAccess({ target: null, value: 'name', sandboxEnabled: true }) as {
      __nunjucks_null__: boolean;
      __nunjucks_access_path__: string;
    };
    expect(nullResult).toBeDefined();
    expect(nullResult.__nunjucks_null__).toBe(true);
    expect(nullResult.__nunjucks_access_path__).toBe('name');
    const undefinedResult = wrapMemberAccess({
      target: undefined,
      value: 'name',
      sandboxEnabled: true,
    }) as { __nunjucks_null__: boolean; __nunjucks_access_path__: string };
    expect(undefinedResult.__nunjucks_null__).toBe(true);
    expect(undefinedResult.__nunjucks_access_path__).toBe('name');
  });

  test('wraps functions in object', () => {
    const obj = { fn: () => 'called' };
    const result = wrapMemberAccess({
      target: obj,
      value: 'fn',
      sandboxEnabled: true,
    }) as () => string;
    expect(typeof result).toBe('function');
    expect(result()).toBe('called');
  });

  test('handles nested dangerous keys', () => {
    const obj = { user: { name: 'test' } };
    const sandboxed = wrapMemberAccess({
      target: obj,
      value: 'user',
      sandboxEnabled: true,
    }) as Record<string, unknown>;
    expect(() => sandboxed.__proto__).toThrow();
  });
});

describe('wrapMemberAccess parity with proxy traps', () => {
  test('blocked symbols throw SANDBOX_ACCESS like the proxy get trap', () => {
    try {
      wrapMemberAccess({ target: {}, value: Symbol('custom'), sandboxEnabled: true });
    } catch (e) {
      expect((e as { code: string }).code).toBe('SANDBOX_ACCESS');
      return;
    }
    throw new Error('Expected custom symbol access to throw');
  });

  test('own well-known symbols stay readable and inherited symbols stay hidden', () => {
    // WHY: parity with the Proxy get trap's policy — custom (non-`Symbol.*`) symbols are
    // blocked in BOTH paths (see the throwing test above); only well-known intrinsics
    // are readable, and only as own properties.
    const obj: Record<string | symbol, unknown> = { [Symbol.toStringTag]: 'own-value' };
    expect(wrapMemberAccess({ target: obj, value: Symbol.toStringTag, sandboxEnabled: true })).toBe(
      'own-value'
    );

    const inheritedCarrier: Record<string | symbol, unknown> = {};
    Object.setPrototypeOf(inheritedCarrier, { [Symbol.toStringTag]: 'Inherited' });
    expect(
      wrapMemberAccess({
        target: inheritedCarrier,
        value: Symbol.toStringTag,
        sandboxEnabled: true,
      })
    ).toBeUndefined();
  });

  test('well-known Symbol.* intrinsics are not treated as escapes', () => {
    const obj: Record<string | symbol, unknown> = { [Symbol.toStringTag]: 'SafeThing' };
    expect(wrapMemberAccess({ target: obj, value: Symbol.toStringTag, sandboxEnabled: true })).toBe(
      'SafeThing'
    );
  });

  test('sandbox-disabled lookups still treat prototype-escape keys as not-found', () => {
    const result = wrapMemberAccess({ target: {}, value: 'constructor', sandboxEnabled: false });
    expect(isPropertyNotFoundResult(result)).toBe(true);
    expect(typeof result).toBe('function');

    const ownResult = wrapMemberAccess({
      target: { constructor: 'host-supplied' },
      value: 'constructor',
      sandboxEnabled: false,
    });
    expect(ownResult).toBe('host-supplied');
  });
});

describe('isAllowedKey', () => {
  test('returns true when no allowlist is configured', () => {
    expect(isAllowedKey('any', null)).toBe(true);
    expect(isAllowedKey('any', undefined)).toBe(true);
  });

  test('returns false for every key when the allowlist is empty (deny-all)', () => {
    expect(isAllowedKey('any', [])).toBe(false);
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

  test('createSandboxedContext applies the requested sandbox environment', () => {
    const ctx = { document: { title: 'safe in node scope' }, process: { env: {} } };
    const sandboxed = createSandboxedContext({
      context: ctx,
      sandboxEnabled: true,
      options: { environment: 'node' },
    }) as {
      document: { title: string };
      process: unknown;
    };

    expect(sandboxed.document.title).toBe('safe in node scope');
    expect(() => sandboxed.process).toThrow();
  });

  test('wrapMemberAccess applies the requested sandbox environment', () => {
    const obj = { document: 'node-local', process: 'node-global' };

    expect(
      wrapMemberAccess({
        target: obj,
        value: 'document',
        sandboxEnabled: true,
        options: { environment: 'node' },
      })
    ).toBe('node-local');
    expect(() =>
      wrapMemberAccess({
        target: obj,
        value: 'process',
        sandboxEnabled: true,
        options: { environment: 'node', topLevel: true },
      })
    ).toThrow();
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
    const sandboxed = createSandboxedObject({
      value: obj,
      sandboxEnabled: true,
      options: { allowlist: [], blocklistMode: true },
    }) as Record<string, unknown>;
    expect(sandboxed.user).toBe('john');
    expect(sandboxed.admin).toBe('secret');
  });

  test('allowlist mode with an empty allowlist denies every key (fail-closed)', () => {
    const obj = { user: 'john', admin: 'secret' };
    const sandboxed = createSandboxedObject({
      value: obj,
      sandboxEnabled: true,
      options: { allowlist: [], blocklistMode: false },
    }) as Record<string, unknown>;

    expect(() => sandboxed.user).toThrow();
    expect(() => sandboxed.admin).toThrow();
    expect(() => sandboxed.__proto__).toThrow();
  });

  test('allowlist mode with an empty allowlist throws SANDBOX_ACCESS for blocked-category keys', () => {
    const sandboxed = createSandboxedObject({
      value: { constructor: Object },
      sandboxEnabled: true,
      options: { allowlist: [], blocklistMode: false },
    }) as Record<string, unknown>;

    try {
      sandboxed.constructor;
    } catch (e) {
      expect((e as { code: string }).code).toBe('SANDBOX_ACCESS');
      return;
    }
    throw new Error('Expected constructor access to throw in deny-all allowlist mode');
  });

  test('allowlist mode with an empty allowlist throws SANDBOX_ALLOWLIST for benign keys', () => {
    const sandboxed = createSandboxedContext({
      context: { user: 'john' },
      sandboxEnabled: true,
      options: { allowlist: [], blocklistMode: false },
    }) as Record<string, unknown>;

    try {
      sandboxed.user;
    } catch (e) {
      expect((e as { code: string }).code).toBe('SANDBOX_ALLOWLIST');
      return;
    }
    throw new Error('Expected user access to throw in deny-all allowlist mode');
  });

  test('allowlist mode with a missing allowlist also denies every key', () => {
    const sandboxed = createSandboxedContext({
      context: { user: 'john' },
      sandboxEnabled: true,
      options: { blocklistMode: false },
    }) as Record<string, unknown>;

    expect(() => sandboxed.user).toThrow();
  });

  test('wrapMemberAccess denies every key in allowlist mode with an empty allowlist', () => {
    expect(() =>
      wrapMemberAccess({
        target: { user: 'john' },
        value: 'user',
        sandboxEnabled: true,
        options: { allowlist: [], blocklistMode: false },
      })
    ).toThrow();
  });

  test('createSandboxedObject blocks non-allowlisted keys in allowlist mode', () => {
    const obj = { user: 'john', admin: 'secret', password: '123' };
    const sandboxed = createSandboxedObject({
      value: obj,
      sandboxEnabled: true,
      options: { allowlist: ['user'], blocklistMode: false },
    }) as Record<string, unknown>;
    expect(sandboxed.user).toBe('john');
    expect(() => sandboxed.admin).toThrow();
    expect(() => sandboxed.password).toThrow();
  });

  test('createSandboxedContext blocks non-allowlisted keys in allowlist mode', () => {
    const ctx = { user: 'john', admin: 'secret' };
    const sandboxed = createSandboxedContext({
      context: ctx,
      sandboxEnabled: true,
      options: { allowlist: ['user'], blocklistMode: false },
    }) as Record<string, unknown>;
    expect(sandboxed.user).toBe('john');
    expect(() => sandboxed.admin).toThrow();
  });

  test('wrapMemberAccess supports allowlist mode', () => {
    const obj = { user: 'john', admin: 'secret' };
    expect(
      wrapMemberAccess({
        target: obj,
        value: 'user',
        sandboxEnabled: true,
        options: { allowlist: ['user'], blocklistMode: false },
      })
    ).toBe('john');
    expect(() =>
      wrapMemberAccess({
        target: obj,
        value: 'admin',
        sandboxEnabled: true,
        options: { allowlist: ['user'], blocklistMode: false },
      })
    ).toThrow();
  });

  test('nested objects inherit allowlist options', () => {
    const obj = { user: { name: 'john', password: '123' } };
    const sandboxed = createSandboxedObject({
      value: obj,
      sandboxEnabled: true,
      options: { allowlist: ['user', 'name'], blocklistMode: false },
    }) as {
      user: Record<string, unknown>;
    };
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
