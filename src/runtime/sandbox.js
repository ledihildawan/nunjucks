import { keys, isNonNullish, isFunction } from 'remeda';
import { isBlockedKey, isDangerousGlobal, isCodeExecutionPattern, BLOCKED_KEYS_LIST, DANGEROUS_GLOBALS_LIST } from '@nunjucks/shared/blocked-keys';
import { createLog } from '@nunjucks/log';
import { ERROR_DEFINITIONS } from '@nunjucks/log/error/messages';

export { isBlockedKey, isDangerousGlobal, isCodeExecutionPattern, BLOCKED_KEYS_LIST, DANGEROUS_GLOBALS_LIST };

const sandboxError = (errorDef, key) => createLog('error', errorDef, { key }, String(key), { phase: 'render', lineBase: 'zero' });

const wrapFunction = (fn, sandboxEnabled, key = null) => {
  if (!sandboxEnabled || !isFunction(fn)) {
    return fn;
  }
  return (...args) => {
    if (key && isCodeExecutionPattern(String(key)) && typeof args[0] === 'string') {
      throw sandboxError(ERROR_DEFINITIONS.SANDBOX_CODE_EXECUTION, key);
    }
    return fn(...args);
  };
};

export const wrapFunctionWithBlocking = (fn, sandboxEnabled, key = null) => {
  if (!sandboxEnabled || !isFunction(fn)) {
    return fn;
  }
  return (...args) => {
    if (key && isCodeExecutionPattern(String(key)) && typeof args[0] === 'string') {
      throw sandboxError(ERROR_DEFINITIONS.SANDBOX_CODE_EXECUTION, key);
    }
    return fn(...args);
  };
};

export const isAllowedKey = (key, allowlist) => {
  if (!allowlist || !Array.isArray(allowlist) || allowlist.length === 0) {
    return true; // No allowlist means allow everything (blocklist mode)
  }
  return allowlist.includes(key);
};

export const createSandboxedObject = (obj, sandboxEnabled, options = {}) => {
  const { allowlist = [], blocklistMode = true } = options;
  
  if (!sandboxEnabled || !isNonNullish(obj)) {
    return obj;
  }

  if (typeof obj !== 'object' && !isFunction(obj)) {
    return obj;
  }

  if (isFunction(obj)) {
    return wrapFunction(obj, sandboxEnabled);
  }

  return new Proxy(obj, {
    get(target, key) {
      // Check blocklist
      if (isBlockedKey(key)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ACCESS, key);
      }

      // Check allowlist if not in blocklist-only mode
      if (!blocklistMode && !isAllowedKey(key, allowlist)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key);
      }
      
      const value = target[key];
      if (isFunction(value)) {
        return wrapFunctionWithBlocking(value, sandboxEnabled, key);
      }
      if (typeof value === 'object' && isNonNullish(value)) {
        return createSandboxedObject(value, sandboxEnabled, options);
      }
      return value;
    },
    set(target, key, value) {
      // Check blocklist
      if (isBlockedKey(key)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_SET, key);
      }

      // Check allowlist if not in blocklist-only mode
      if (!blocklistMode && !isAllowedKey(key, allowlist)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key);
      }
      
      target[key] = value;
      return true;
    },
    has(target, key) {
      if (isBlockedKey(key)) {
        return false;
      }
      return key in target;
    },
  });
};

export const createSandboxedContext = (context, sandboxEnabled, options = {}) => {
  const { allowlist = [], blocklistMode = true } = options;
  
  if (!sandboxEnabled) {
    return context;
  }

  if (!context || typeof context !== 'object') {
    return context;
  }

  return new Proxy(context, {
    get(target, key) {
      if (isBlockedKey(key)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ACCESS, key);
      }

      if (!blocklistMode && !isAllowedKey(key, allowlist)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key);
      }

      const value = target[key];

      if (isFunction(value)) {
        return wrapFunctionWithBlocking(value, sandboxEnabled, key);
      }

      if (typeof value === 'object' && isNonNullish(value)) {
        return createSandboxedObject(value, sandboxEnabled, options);
      }

      return value;
    },
    set(target, key, value) {
      if (isBlockedKey(key)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_SET, key);
      }

      if (!blocklistMode && !isAllowedKey(key, allowlist)) {
        throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, key);
      }
      
      target[key] = value;
      return true;
    },
    has(target, key) {
      if (isBlockedKey(key)) {
        return false;
      }
      if (!blocklistMode && !isAllowedKey(key, allowlist)) {
        return false;
      }
      return key in target;
    }
  });
};

export const wrapMemberAccess = (obj, val, sandboxEnabled, options = {}) => {
  const { allowlist = [], blocklistMode = true } = options;
  
  if (!sandboxEnabled) {
    return obj?.[val];
  }

  if (isBlockedKey(val)) {
    throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ACCESS, val);
  }

  if (!blocklistMode && !isAllowedKey(val, allowlist)) {
    throw sandboxError(ERROR_DEFINITIONS.SANDBOX_ALLOWLIST, val);
  }

  const value = obj?.[val];

  if (isFunction(value)) {
    return wrapFunctionWithBlocking(value, sandboxEnabled, val);
  }

  if (typeof value === 'object' && isNonNullish(value)) {
    return createSandboxedObject(value, sandboxEnabled, options);
  }

  return value;
};
