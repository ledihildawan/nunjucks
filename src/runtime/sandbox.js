import { keys, isNonNullish, isFunction } from 'remeda';
import {
  isBlockedKey,
  isDangerousGlobal,
  isCodeExecutionPattern,
  getBlockedKeyCategory,
  BLOCKED_KEYS_LIST,
  DANGEROUS_GLOBALS_LIST
} from '@nunjucks/shared/blocked-keys';
import { createLog } from '@nunjucks/log';
import { ERROR_DEFINITIONS } from '@nunjucks/log/error/messages';

export {
  isBlockedKey,
  isDangerousGlobal,
  isCodeExecutionPattern,
  getBlockedKeyCategory,
  BLOCKED_KEYS_LIST,
  DANGEROUS_GLOBALS_LIST
};

const sandboxError = (errorDef, key, options = {}) => {
  const env = options.environment || 'auto';
  const category = getBlockedKeyCategory(key, env);
  return createLog('error', errorDef, { key, category, environment: env }, String(key), { phase: 'render', lineBase: 'zero' });
};

export const resolveSandboxOptions = (options = {}) => ({
  allowlist: options.allowlist || [],
  blocklistMode: options.blocklistMode ?? true,
  environment: options.environment || options.env || 'auto'
});

const wrapFunction = (fn, sandboxEnabled, key = null, options = {}, thisArg = null) => {
  if (!sandboxEnabled || !isFunction(fn)) {
    return fn;
  }
  return (...args) => {
    if (key && isCodeExecutionPattern(String(key)) && typeof args[0] === 'string') {
      throw sandboxError(ERROR_DEFINITIONS.SANDBOX_CODE_EXECUTION, key, options);
    }
    return fn.apply(thisArg, args);
  };
};

export const wrapFunctionWithBlocking = (fn, sandboxEnabled, key = null, options = {}, thisArg = null) => {
  if (!sandboxEnabled || !isFunction(fn)) {
    return fn;
  }
  return (...args) => {
    if (key && isCodeExecutionPattern(String(key)) && typeof args[0] === 'string') {
      throw sandboxError(ERROR_DEFINITIONS.SANDBOX_CODE_EXECUTION, key, options);
    }
    return fn.apply(thisArg, args);
  };
};

export const isAllowedKey = (key, allowlist) => {
  if (!allowlist || !Array.isArray(allowlist) || allowlist.length === 0) {
    return true; // No allowlist means allow everything (blocklist mode)
  }
  return allowlist.includes(key);
};

const isBlockedAtScope = (key, options, topLevel = false) => {
  if (typeof key === 'symbol') return false;
  const category = getBlockedKeyCategory(key, options.environment);
  if (!category) return false;
  return topLevel || category === 'object_intrinsic';
};

const hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target, key);

export const createSandboxedObject = (obj, sandboxEnabled, options = {}) => {
  const sandboxOptions = resolveSandboxOptions(options);
  const { allowlist, blocklistMode } = sandboxOptions;
  
  if (!sandboxEnabled || !isNonNullish(obj)) {
    return obj;
  }

  if (typeof obj !== 'object' && !isFunction(obj)) {
    return obj;
  }

  if (isFunction(obj)) {
    return wrapFunction(obj, sandboxEnabled, null, sandboxOptions);
  }

  return new Proxy(obj, {
    get(target, key) {
      if (typeof key === 'symbol') {
        return target[key];
      }

      // Check blocklist
      if (isBlockedAtScope(key, sandboxOptions, false)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ACCESS, key, sandboxOptions);
      }

      // Check allowlist if not in blocklist-only mode
      if (!blocklistMode && !isAllowedKey(key, allowlist)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions);
      }
      
      if (!hasOwn(target, key)) {
        return undefined;
      }

      const value = target[key];
      if (isFunction(value)) {
        return wrapFunctionWithBlocking(value, sandboxEnabled, key, sandboxOptions, target);
      }
      if (typeof value === 'object' && isNonNullish(value)) {
        return createSandboxedObject(value, sandboxEnabled, sandboxOptions);
      }
      return value;
    },
    set(target, key, value) {
      if (typeof key === 'symbol') {
        target[key] = value;
        return true;
      }

      // Check blocklist
      if (isBlockedAtScope(key, sandboxOptions, false)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_SET, key, sandboxOptions);
      }

      // Check allowlist if not in blocklist-only mode
      if (!blocklistMode && !isAllowedKey(key, allowlist)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions);
      }
      
      target[key] = value;
      return true;
    },
    has(target, key) {
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

export const createSandboxedContext = (context, sandboxEnabled, options = {}) => {
  const sandboxOptions = resolveSandboxOptions(options);
  const { allowlist, blocklistMode } = sandboxOptions;
  
  if (!sandboxEnabled) {
    return context;
  }

  if (!context || typeof context !== 'object') {
    return context;
  }

  return new Proxy(context, {
    get(target, key) {
      if (typeof key === 'symbol') {
        return target[key];
      }

      if (isBlockedAtScope(key, sandboxOptions, true)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ACCESS, key, sandboxOptions);
      }

      if (!blocklistMode && !isAllowedKey(key, allowlist)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions);
      }

      if (!hasOwn(target, key)) {
        return undefined;
      }

      const value = target[key];

      if (isFunction(value)) {
        return wrapFunctionWithBlocking(value, sandboxEnabled, key, sandboxOptions, target);
      }

      if (typeof value === 'object' && isNonNullish(value)) {
        return createSandboxedObject(value, sandboxEnabled, sandboxOptions);
      }

      return value;
    },
    set(target, key, value) {
      if (typeof key === 'symbol') {
        target[key] = value;
        return true;
      }

      if (isBlockedAtScope(key, sandboxOptions, true)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_SET, key, sandboxOptions);
      }

      if (!blocklistMode && !isAllowedKey(key, allowlist)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key, sandboxOptions);
      }
      
      target[key] = value;
      return true;
    },
    has(target, key) {
      if (typeof key === 'symbol') {
        return key in target;
      }
      if (isBlockedAtScope(key, sandboxOptions, true)) {
        return false;
      }
      if (!blocklistMode && !isAllowedKey(key, allowlist)) {
        return false;
      }
      return hasOwn(target, key);
    }
  });
};

export const wrapMemberAccess = (obj, val, sandboxEnabled, options = {}) => {
  const sandboxOptions = resolveSandboxOptions(options);
  const { allowlist, blocklistMode, topLevel = false } = { ...sandboxOptions, topLevel: options.topLevel ?? false };
  
  if (!sandboxEnabled) {
    return obj?.[val];
  }

  if (typeof val === 'symbol') {
    return obj?.[val];
  }

  if (isBlockedAtScope(val, sandboxOptions, topLevel)) {
    throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ACCESS, val, sandboxOptions);
  }

  if (!blocklistMode && !isAllowedKey(val, allowlist)) {
    throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, val, sandboxOptions);
  }

  if (!isNonNullish(obj) || !hasOwn(obj, val)) {
    return undefined;
  }

  const value = obj[val];

  if (isFunction(value)) {
    return wrapFunctionWithBlocking(value, sandboxEnabled, val, sandboxOptions, obj);
  }

  if (typeof value === 'object' && isNonNullish(value)) {
    return createSandboxedObject(value, sandboxEnabled, sandboxOptions);
  }

  return value;
};
