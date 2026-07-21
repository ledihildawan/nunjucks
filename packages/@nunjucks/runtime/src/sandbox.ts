// SANDBOX - Secure member access via Proxy wrapping
// Import directly: import { createSandboxedContext } from '@nunjucks/runtime/sandbox'

import {
  isBlockedKey,
  isDangerousGlobal,
  isCodeExecutionPattern,
  getBlockedKeyCategory,
  BLOCKED_KEYS_LIST,
  DANGEROUS_GLOBALS_LIST,
  type Environment,
} from '@nunjucks/shared/blocked-keys';
import { createLog, ERROR_DEFINITIONS } from '@nunjucks/log';

export {
  isBlockedKey,
  isDangerousGlobal,
  isCodeExecutionPattern,
  getBlockedKeyCategory,
  BLOCKED_KEYS_LIST,
  DANGEROUS_GLOBALS_LIST,
};

const isNonNullish = (v: unknown): boolean => v !== null && v !== undefined;
const isFunction = (v: unknown): boolean => typeof v === 'function';

const sandboxError = (errorDef: unknown, key: string | symbol, options: SandboxOptions = {}): Error => {
  const env = options.environment || 'auto';
  const category = getBlockedKeyCategory(String(key), env);
  return createLog('error', errorDef, { key: String(key), category, environment: env }, String(key), { phase: 'render', lineBase: 'zero' });
};

export interface SandboxOptions {
  allowlist?: string[];
  blocklistMode?: boolean;
  environment?: Environment;
  env?: Environment;
  topLevel?: boolean;
}

export const resolveSandboxOptions = (options: SandboxOptions = {}): Required<Omit<SandboxOptions, 'topLevel'>> => ({
  allowlist: options.allowlist || [],
  blocklistMode: options.blocklistMode ?? true,
  environment: options.environment || options.env || 'auto',
});

const wrapFunction = (
  fn: (...args: unknown[]) => unknown,
  sandboxEnabled: boolean,
  key: string | null,
  options: Required<Omit<SandboxOptions, 'topLevel'>>,
  thisArg: unknown,
): ((...args: unknown[]) => unknown) => {
  if (!sandboxEnabled || !isFunction(fn)) {
    return fn;
  }
  return (...args: unknown[]) => {
    if (key && isCodeExecutionPattern(String(key)) && typeof args[0] === 'string') {
      throw sandboxError(ERROR_DEFINITIONS.SANDBOX_CODE_EXECUTION, key, options);
    }
    return fn.apply(thisArg, args);
  };
};

export const wrapFunctionWithBlocking = (
  fn: (...args: unknown[]) => unknown,
  sandboxEnabled: boolean,
  key: string | null,
  options: Required<Omit<SandboxOptions, 'topLevel'>>,
  thisArg: unknown,
): ((...args: unknown[]) => unknown) => {
  if (!sandboxEnabled || !isFunction(fn)) {
    return fn;
  }
  return (...args: unknown[]) => {
    if (key && isCodeExecutionPattern(String(key)) && typeof args[0] === 'string') {
      throw sandboxError(ERROR_DEFINITIONS.SANDBOX_CODE_EXECUTION, key, options);
    }
    return fn.apply(thisArg, args);
  };
};

export const isAllowedKey = (key: string, allowlist: string[] | null | undefined): boolean => {
  if (!allowlist || !Array.isArray(allowlist) || allowlist.length === 0) {
    return true;
  }
  return allowlist.includes(key);
};

const isBlockedAtScope = (key: string | symbol, options: Required<Omit<SandboxOptions, 'topLevel'>>, topLevel = false): boolean => {
  if (typeof key === 'symbol') return false;
  const category = getBlockedKeyCategory(key as string, options.environment);
  if (!category) return false;
  return topLevel || category === 'object_intrinsic';
};

const hasOwn = (target: object, key: string | symbol): boolean => Object.prototype.hasOwnProperty.call(target, key);
const isInternalKey = (key: string | symbol): boolean => typeof key === 'string' && key.startsWith('__nunjucks');

export const createSandboxedObject = (obj: unknown, sandboxEnabled: boolean, options: SandboxOptions = {}): unknown => {
  const sandboxOptions = resolveSandboxOptions(options);
  const { allowlist, blocklistMode } = sandboxOptions;

  if (!sandboxEnabled || !isNonNullish(obj)) {
    return obj;
  }

  if (typeof obj !== 'object' && !isFunction(obj)) {
    return obj;
  }

  if (isFunction(obj)) {
    return wrapFunction(obj as (...args: unknown[]) => unknown, sandboxEnabled, null, sandboxOptions, null);
  }

  return new Proxy(obj as object, {
    get(target: Record<string | symbol, unknown>, key: string | symbol): unknown {
      if (typeof key === 'symbol') {
        return target[key];
      }

      if (isBlockedAtScope(key, sandboxOptions, false)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ACCESS, key, sandboxOptions);
      }

      if (!blocklistMode && !isAllowedKey(key as string, allowlist)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions);
      }

      if (!hasOwn(target, key)) {
        return undefined;
      }

      const value = target[key];
      if (isFunction(value)) {
        return wrapFunctionWithBlocking(value as (...args: unknown[]) => unknown, sandboxEnabled, key as string, sandboxOptions, target);
      }
      if (typeof value === 'object' && isNonNullish(value)) {
        return createSandboxedObject(value, sandboxEnabled, sandboxOptions);
      }
      return value;
    },
    set(target: Record<string | symbol, unknown>, key: string | symbol, value: unknown): boolean {
      if (typeof key === 'symbol') {
        target[key] = value;
        return true;
      }

      if (isBlockedAtScope(key, sandboxOptions, false)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_SET, key, sandboxOptions);
      }

      if (!blocklistMode && !isAllowedKey(key as string, allowlist)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions);
      }

      target[key] = value;
      return true;
    },
    has(target: Record<string | symbol, unknown>, key: string | symbol): boolean {
      if (typeof key === 'symbol') {
        return key in target;
      }
      if (isBlockedAtScope(key, sandboxOptions, false)) {
        return false;
      }
      return hasOwn(target, key);
    },
  });
};

export const createSandboxedContext = (context: unknown, sandboxEnabled: boolean, options: SandboxOptions = {}): unknown => {
  const sandboxOptions = resolveSandboxOptions(options);
  const { allowlist, blocklistMode } = sandboxOptions;

  if (!sandboxEnabled) {
    return context;
  }

  if (!context || typeof context !== 'object') {
    return context;
  }

  return new Proxy(context as object, {
    get(target: Record<string | symbol, unknown>, key: string | symbol): unknown {
      if (typeof key === 'symbol') {
        return target[key];
      }

      if (isBlockedAtScope(key, sandboxOptions, true)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ACCESS, key, sandboxOptions);
      }

      if (!blocklistMode && !isAllowedKey(key as string, allowlist)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions);
      }

      if (!hasOwn(target, key)) {
        return undefined;
      }

      const value = target[key];

      if (isFunction(value)) {
        return wrapFunctionWithBlocking(value as (...args: unknown[]) => unknown, sandboxEnabled, key as string, sandboxOptions, target);
      }

      if (typeof value === 'object' && isNonNullish(value)) {
        return createSandboxedObject(value, sandboxEnabled, sandboxOptions);
      }

      return value;
    },
    set(target: Record<string | symbol, unknown>, key: string | symbol, value: unknown): boolean {
      if (typeof key === 'symbol') {
        target[key] = value;
        return true;
      }

      if (isInternalKey(key)) {
        target[key] = value;
        return true;
      }

      if (isBlockedAtScope(key, sandboxOptions, true)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_SET, key, sandboxOptions);
      }

      if (!blocklistMode && !isAllowedKey(key as string, allowlist)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions);
      }

      throw sandboxError(ERROR_DEFINITIONS.SANDBOX_CONTEXT_MODIFY, key, sandboxOptions);
    },
    has(target: Record<string | symbol, unknown>, key: string | symbol): boolean {
      if (typeof key === 'symbol') {
        return key in target;
      }
      if (isBlockedAtScope(key, sandboxOptions, true)) {
        return false;
      }
      if (!blocklistMode && !isAllowedKey(key as string, allowlist)) {
        return false;
      }
      return hasOwn(target, key);
    },
  });
};

export const wrapMemberAccess = (obj: unknown, val: string | symbol, sandboxEnabled: boolean, options: SandboxOptions = {}, parentName: string | null = null): unknown => {
  const sandboxOptions = resolveSandboxOptions(options);
  const { allowlist, blocklistMode, topLevel = options.topLevel ?? false } = { ...sandboxOptions, topLevel: options.topLevel ?? false };

  if (!sandboxEnabled) {
    if (!isNonNullish(obj)) {
      return { __nunjucks_null__: true, __nunjucks_parent__: parentName, __access_path__: val };
    }
    return (obj as Record<string | symbol, unknown>)?.[val];
  }

  if (typeof val === 'symbol') {
    return (obj as Record<string | symbol, unknown>)?.[val];
  }

  if (isBlockedAtScope(val as string, sandboxOptions, topLevel)) {
    throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ACCESS, val, sandboxOptions);
  }

  if (!blocklistMode && !isAllowedKey(val as string, allowlist)) {
    throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, val, sandboxOptions);
  }

  if (!isNonNullish(obj)) {
    return { __nunjucks_null__: true, __nunjucks_parent__: parentName, __access_path__: val };
  }

  const target = obj as Record<string, unknown>;
  if (!hasOwn(target, val as string)) {
    const callable = (() => undefined) as unknown as Record<string, unknown>;
    Object.setPrototypeOf(callable, null);
    Object.assign(callable, {
      __nunjucks_prop_not_found__: true,
      __nunjucks_parent__: parentName,
      __access_path__: val,
    });
    return callable;
  }

  const value = target[val as string];

  if (isFunction(value)) {
    return wrapFunctionWithBlocking(value as (...args: unknown[]) => unknown, sandboxEnabled, val as string, sandboxOptions, target);
  }

  if (typeof value === 'object' && isNonNullish(value)) {
    return createSandboxedObject(value, sandboxEnabled, sandboxOptions);
  }

  return value;
};
