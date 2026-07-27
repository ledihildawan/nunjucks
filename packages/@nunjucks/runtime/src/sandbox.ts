// SANDBOX - Secure member access via Proxy wrapping
import {
  isCodeExecutionPattern,
  getBlockedKeyCategory,
  type Environment,
} from '@nunjucks/shared/blocked-keys';
import { isNonNullish, isFunction, hasOwn } from '@nunjucks/shared/type-guards';
import { createLog, ERROR_DEFINITIONS } from '@nunjucks/log';
import type { ErrorDefinitionEntry, TemplateError, TemplateWarning } from '@nunjucks/log/create-log';

const UNSAFE_SYMBOL_DESCRIPTIONS = new Set([
  'constructor',
  'prototype',
  '__proto__',
  'toString',
  'valueOf',
  'hasOwnProperty',
]);

const isBlockedSymbol = (key: symbol): boolean => {
  const desc = key.description;
  if (!desc) { return true; }
  if (UNSAFE_SYMBOL_DESCRIPTIONS.has(desc)) { return true; }
  if (desc.startsWith('Symbol.')) { return false; }
  return true;
};

const sandboxError = (errorDef: ErrorDefinitionEntry | undefined, key: string | symbol, options: SandboxOptions = {}): TemplateError | TemplateWarning => {
  if (!errorDef) {
    const err = new Error(`Sandbox error: ${String(key)}`) as TemplateError;
    err.code = 'SANDBOX_ERROR';
    return err;
  }
  const env = options.environment || 'auto';
  const category = getBlockedKeyCategory(String(key), env);
  return createLog('error', errorDef, { key: String(key), category: category ?? '', environment: env }, String(key), { phase: 'render', lineBase: 'zero' });
};

const blockedKeysError = (key: string, blockedKeys: string[]): TemplateError | TemplateWarning => {
  const errorDef = ERROR_DEFINITIONS.BLOCKED_CONTEXT_KEYS;
  if (!errorDef) {
    const err = new Error(`Blocked context key: ${key}`) as TemplateError;
    err.code = 'BLOCKED_CONTEXT_KEYS';
    return err;
  }
  return createLog('error', errorDef, { keys: blockedKeys.join(', ') }, key, { phase: 'render', lineBase: 'zero' });
};

interface SandboxOptions {
  allowlist?: string[];
  blocklistMode?: boolean;
  blockedContextKeys?: string[];
  environment?: Environment;
  env?: Environment;
  topLevel?: boolean;
}

type ResolvedSandboxOptions = Required<Omit<SandboxOptions, 'topLevel' | 'env'>>;

const resolveSandboxOptions = (options: SandboxOptions = {}): ResolvedSandboxOptions => ({
  allowlist: options.allowlist || [],
  blocklistMode: options.blocklistMode ?? true,
  blockedContextKeys: options.blockedContextKeys || [],
  environment: options.environment || options.env || 'auto',
});

const wrapFunctionWithBlocking = (
  fn: (...args: unknown[]) => unknown,
  sandboxEnabled: boolean,
  key: string | null,
  options: ResolvedSandboxOptions,
  thisArg: unknown,
): ((...args: unknown[]) => unknown) => {
  if (!(sandboxEnabled && isFunction(fn))) {
    return fn;
  }
  return (...args: unknown[]) => {
    if (key && isCodeExecutionPattern(String(key)) && typeof args[0] === 'string') {
      throw sandboxError(ERROR_DEFINITIONS.SANDBOX_CODE_EXECUTION, key, options);
    }
    return fn.apply(thisArg, args);
  };
};

const isAllowedKey = (key: string, allowlist: string[] | null | undefined): boolean => {
  if (!(allowlist && Array.isArray(allowlist) ) || allowlist.length === 0) {
    return true;
  }
  return allowlist.includes(key);
};

const isBlockedAtScope = (key: string | symbol, options: ResolvedSandboxOptions, topLevel = false): boolean => {
  if (typeof key === 'symbol') { return false; }
  const category = getBlockedKeyCategory(key as string, options.environment);
  if (!category) { return false; }
  return topLevel || category === 'object_intrinsic';
};

const isInternalKey = (key: string | symbol): boolean => {
  if (typeof key !== 'string') { return false; }
  return key === '__nunjucks' || key.startsWith('__nunjucks_');
};

const DANGEROUS_OBJECT_INTRINSICS = new Set(['__proto__', 'constructor', 'prototype']);

const makeSandboxTraps = (
  sandboxEnabled: boolean,
  sandboxOptions: ResolvedSandboxOptions,
  topLevel: boolean,
): ProxyHandler<Record<string | symbol, unknown>> => {
  const { allowlist, blocklistMode, blockedContextKeys } = sandboxOptions;

  const validateStringKey = (target: Record<string | symbol, unknown>, key: string): unknown => {
    if (topLevel && blockedContextKeys.includes(key)) {
      throw blockedKeysError(key, blockedContextKeys);
    }
    if (isBlockedAtScope(key, sandboxOptions, topLevel)) {
      if (hasOwn(target, key) || DANGEROUS_OBJECT_INTRINSICS.has(key)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ACCESS, key, sandboxOptions);
      }
      return;
    }
    if (!(blocklistMode || isAllowedKey(key, allowlist))) {
      throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions);
    }
    if (!hasOwn(target, key)) {
      return;
    }
    const value = target[key];
    if (isFunction(value)) {
      return wrapFunctionWithBlocking(value as (...args: unknown[]) => unknown, sandboxEnabled, key, sandboxOptions, target);
    }
    if (typeof value === 'object' && isNonNullish(value)) {
      return createSandboxedObject(value, sandboxEnabled, sandboxOptions);
    }
    return value;
  };

  const validateSetKey = (target: Record<string | symbol, unknown>, key: string, value: unknown): boolean => {
    if (topLevel && isInternalKey(key)) {
      target[key] = value;
      return true;
    }
    if (isBlockedAtScope(key, sandboxOptions, topLevel)) {
      throw sandboxError(ERROR_DEFINITIONS.SANDBOX_SET, key, sandboxOptions);
    }
    if (!(blocklistMode || isAllowedKey(key, allowlist))) {
      throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions);
    }
    if (topLevel) {
      throw sandboxError(ERROR_DEFINITIONS.SANDBOX_CONTEXT_MODIFY, key, sandboxOptions);
    }
    target[key] = value;
    return true;
  };

  const validateHasKey = (target: Record<string | symbol, unknown>, key: string): boolean => {
    if (isBlockedAtScope(key, sandboxOptions, topLevel)) {
      return false;
    }
    if (topLevel && !blocklistMode && !isAllowedKey(key, allowlist)) {
      return false;
    }
    return hasOwn(target, key);
  };

  return {
    get(target, key): unknown {
      if (typeof key === 'symbol') {
        if (isBlockedSymbol(key)) {
          throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ACCESS, key, sandboxOptions);
        }
        return target[key];
      }
      return validateStringKey(target, key);
    },
    set(target, key, value): boolean {
      if (typeof key === 'symbol') {
        if (isBlockedSymbol(key)) {
          throw sandboxError(ERROR_DEFINITIONS.SANDBOX_SET, key, sandboxOptions);
        }
        target[key] = value;
        return true;
      }
      return validateSetKey(target, key, value);
    },
    has(target, key): boolean {
      if (typeof key === 'symbol') {
        if (isBlockedSymbol(key)) {
          return false;
        }
        return key in target;
      }
      return validateHasKey(target, key);
    },
  };
};

const createSandboxedObject = (obj: unknown, sandboxEnabled: boolean, options: SandboxOptions = {}): unknown => {
  const sandboxOptions = resolveSandboxOptions(options);

  if (!(sandboxEnabled && isNonNullish(obj))) {
    return obj;
  }

  if (typeof obj !== 'object' && !isFunction(obj)) {
    return obj;
  }

  if (isFunction(obj)) {
    return wrapFunctionWithBlocking(obj as (...args: unknown[]) => unknown, sandboxEnabled, null, sandboxOptions, null);
  }

  return new Proxy(obj as object, makeSandboxTraps(sandboxEnabled, sandboxOptions, false));
};

const createSandboxedContext = (context: unknown, sandboxEnabled: boolean, options: SandboxOptions = {}): unknown => {
  const sandboxOptions = resolveSandboxOptions(options);

  if (!sandboxEnabled) {
    return context;
  }

  if (!context || typeof context !== 'object') {
    return context;
  }

  return new Proxy(context as object, makeSandboxTraps(sandboxEnabled, sandboxOptions, true));
};

const createPropertyNotFoundCallable = (val: string | symbol, parentName: string | null) => {
  const callable = Object.assign(() => undefined, {
    __nunjucks_prop_not_found__: true,
    __nunjucks_parent__: parentName,
    __access_path__: val,
  });
  Object.setPrototypeOf(callable, null);
  return callable;
};

const validateStringAccess = (val: string, sandboxOptions: ResolvedSandboxOptions, allowlist: Set<string>, blocklistMode: boolean, topLevel: boolean): void => {
  if (isBlockedAtScope(val, sandboxOptions, topLevel)) {
    throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ACCESS, val, sandboxOptions);
  }
  if (!(blocklistMode || isAllowedKey(val, allowlist))) {
    throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, val, sandboxOptions);
  }
};

const wrapMemberAccess = (obj: unknown, val: string | symbol, sandboxEnabled: boolean, options: SandboxOptions = {}, parentName: string | null = null): unknown => {
  const sandboxOptions = resolveSandboxOptions(options);
  const { allowlist, blocklistMode, topLevel = options.topLevel ?? false } = { ...sandboxOptions, topLevel: options.topLevel ?? false };

  if (!sandboxEnabled) {
    if (!isNonNullish(obj)) {
      return { __nunjucks_null__: true, __nunjucks_parent__: parentName, __access_path__: val };
    }
    // Guarded directly above, so no optional chain needed here.
    return (obj as Record<string | symbol, unknown>)[val];
  }

  if (typeof val === 'symbol') {
    // Not guarded on this path: `obj` is still unknown and may be nullish, so
    // the cast keeps `undefined` and the optional chain stays load-bearing.
    return (obj as Record<string | symbol, unknown> | undefined)?.[val];
  }

  validateStringAccess(val, sandboxOptions, allowlist, blocklistMode, topLevel);

  if (!isNonNullish(obj)) {
    return { __nunjucks_null__: true, __nunjucks_parent__: parentName, __access_path__: val };
  }

  const target = obj as Record<string, unknown>;
  if (!hasOwn(target, val)) {
    return createPropertyNotFoundCallable(val, parentName);
  }

  const value = target[val];

  if (isFunction(value)) {
    return wrapFunctionWithBlocking(value as (...args: unknown[]) => unknown, sandboxEnabled, val, sandboxOptions, target);
  }

  if (typeof value === 'object' && isNonNullish(value)) {
    return createSandboxedObject(value, sandboxEnabled, sandboxOptions);
  }

  return value;
};

export { resolveSandboxOptions, wrapFunctionWithBlocking, isAllowedKey, createSandboxedObject, createSandboxedContext, wrapMemberAccess };
export type { SandboxOptions, ResolvedSandboxOptions };

export {
  isBlockedKey,
  isDangerousGlobal,
  isCodeExecutionPattern,
  getBlockedKeyCategory,
  BLOCKED_KEYS_LIST,
  DANGEROUS_GLOBALS_LIST,
} from '@nunjucks/shared/blocked-keys';
