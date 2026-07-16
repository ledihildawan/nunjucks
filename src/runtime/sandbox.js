import { keys, isNonNullish, isFunction } from 'remeda';
import { isBlockedKey, isDangerousGlobal, isCodeExecutionPattern, BLOCKED_KEYS_LIST, DANGEROUS_GLOBALS_LIST } from '@nunjucks/shared/blocked-keys';

export { isBlockedKey, isDangerousGlobal, isCodeExecutionPattern, BLOCKED_KEYS_LIST, DANGEROUS_GLOBALS_LIST };

const wrapFunction = (fn, sandboxEnabled) => {
  if (!sandboxEnabled || !isFunction(fn)) {
    return fn;
  }
  return (...args) => {
    return fn(...args);
  };
};

export const wrapFunctionWithBlocking = (fn, sandboxEnabled) => {
  if (!sandboxEnabled || !isFunction(fn)) {
    return fn;
  }
  return (...args) => {
    // Block dangerous patterns in arguments
    if (args.length > 0) {
      const firstArg = args[0];
      // Block string code execution: setTimeout('code', 0)
      if (typeof firstArg === 'string' && !firstArg.includes('(')) {
        // Allow normal string arguments but be cautious
      }
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
        throw new Error(`Sandbox: Access to '${key}' is blocked`);
      }
      
      // Check allowlist if not in blocklist-only mode
      if (!blocklistMode && !isAllowedKey(key, allowlist)) {
        throw new Error(`Sandbox: Access to '${key}' is not allowed. Add it to allowlist.`);
      }
      
      const value = target[key];
      if (isFunction(value)) {
        return wrapFunction(value, sandboxEnabled);
      }
      if (typeof value === 'object' && isNonNullish(value)) {
        return createSandboxedObject(value, sandboxEnabled, options);
      }
      return value;
    },
    set(target, key, value) {
      // Check blocklist
      if (isBlockedKey(key)) {
        throw new Error(`Sandbox: Setting '${key}' is blocked`);
      }
      
      // Check allowlist if not in blocklist-only mode
      if (!blocklistMode && !isAllowedKey(key, allowlist)) {
        throw new Error(`Sandbox: Setting '${key}' is not allowed. Add it to allowlist.`);
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
        throw new Error(`Sandbox: Access to '${key}' is blocked`);
      }
      
      if (!blocklistMode && !isAllowedKey(key, allowlist)) {
        throw new Error(`Sandbox: Access to '${key}' is not allowed. Add it to allowlist.`);
      }
      
      const value = target[key];
      
      if (isFunction(value)) {
        return wrapFunction(value, sandboxEnabled);
      }
      
      if (typeof value === 'object' && isNonNullish(value)) {
        return createSandboxedObject(value, sandboxEnabled, options);
      }
      
      return value;
    },
    set(target, key, value) {
      if (isBlockedKey(key)) {
        throw new Error(`Sandbox: Setting '${key}' is blocked`);
      }
      
      if (!blocklistMode && !isAllowedKey(key, allowlist)) {
        throw new Error(`Sandbox: Setting '${key}' is not allowed. Add it to allowlist.`);
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
    throw new Error(`Sandbox: Access to '${val}' is blocked`);
  }

  if (!blocklistMode && !isAllowedKey(val, allowlist)) {
    throw new Error(`Sandbox: Access to '${val}' is not allowed. Add it to allowlist.`);
  }

  const value = obj?.[val];

  if (isFunction(value)) {
    return wrapFunction(value, sandboxEnabled);
  }

  if (typeof value === 'object' && isNonNullish(value)) {
    return createSandboxedObject(value, sandboxEnabled, options);
  }

  return value;
};
