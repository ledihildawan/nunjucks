import { keys, isNonNullish, isFunction } from 'remeda';
import { isBlockedKey, isDangerousGlobal, BLOCKED_KEYS_LIST, DANGEROUS_GLOBALS_LIST } from '../shared/blocked-keys.js';

export { isBlockedKey, isDangerousGlobal, BLOCKED_KEYS_LIST, DANGEROUS_GLOBALS_LIST };

export const wrapFunction = (fn, sandboxEnabled) => {
  if (!sandboxEnabled || !isFunction(fn)) {
    return fn;
  }
  return (...args) => {
    return fn(...args);
  };
};

export const createSandboxedObject = (obj, sandboxEnabled) => {
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
      if (isBlockedKey(key)) {
        throw new Error(`Sandbox: Access to '${key}' is blocked`);
      }
      const value = target[key];
      if (isFunction(value)) {
        return wrapFunction(value, sandboxEnabled);
      }
      if (typeof value === 'object' && isNonNullish(value)) {
        return createSandboxedObject(value, sandboxEnabled);
      }
      return value;
    },
    set(target, key, value) {
      if (isBlockedKey(key)) {
        throw new Error(`Sandbox: Setting '${key}' is blocked`);
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

export const createSandboxedContext = (context, sandboxEnabled) => {
  if (!sandboxEnabled) {
    return context;
  }

  if (!context || typeof context !== 'object') {
    return context;
  }

  const sandboxed = {};
  for (const key of keys(context)) {
    sandboxed[key] = createSandboxedObject(context[key], sandboxEnabled);
  }

  return sandboxed;
};

export const wrapMemberAccess = (obj, val, sandboxEnabled) => {
  if (!sandboxEnabled) {
    return obj?.[val];
  }

  if (isBlockedKey(val)) {
    throw new Error(`Sandbox: Access to '${val}' is blocked`);
  }

  const value = obj?.[val];

  if (isFunction(value)) {
    return wrapFunction(value, sandboxEnabled);
  }

  if (typeof value === 'object' && isNonNullish(value)) {
    return createSandboxedObject(value, sandboxEnabled);
  }

  return value;
};
