const BLOCKED_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'hasOwnProperty',
  'toString',
  'valueOf',
  'global',
  'globalThis',
  'window',
  'process',
  'eval',
  'Function',
]);

const DANGEROUS_GLOBALS = new Set([
  'global',
  'globalThis',
  'window',
  'process',
  'eval',
  'Function',
  'require',
  'module',
  'exports',
  '__dirname',
  '__filename',
]);

export const isBlockedKey = (key) => BLOCKED_KEYS.has(key);

export const isDangerousGlobal = (key) => DANGEROUS_GLOBALS.has(key);

export const wrapFunction = (fn, sandboxEnabled) => {
  if (!sandboxEnabled || typeof fn !== 'function') {
    return fn;
  }
  return (...args) => {
    return fn(...args);
  };
};

export const createSandboxedObject = (obj, sandboxEnabled) => {
  if (!sandboxEnabled || obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object' && typeof obj !== 'function') {
    return obj;
  }

  if (typeof obj === 'function') {
    return wrapFunction(obj, sandboxEnabled);
  }

  return new Proxy(obj, {
    get(target, key) {
      if (isBlockedKey(key)) {
        throw new Error(`Sandbox: Access to '${key}' is blocked`);
      }
      const value = target[key];
      if (typeof value === 'function') {
        return wrapFunction(value, sandboxEnabled);
      }
      if (typeof value === 'object' && value !== null) {
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
  for (const key of Object.keys(context)) {
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

  if (typeof value === 'function') {
    return wrapFunction(value, sandboxEnabled);
  }

  if (typeof value === 'object' && value !== null) {
    return createSandboxedObject(value, sandboxEnabled);
  }

  return value;
};

export const BLOCKED_KEYS_LIST = [...BLOCKED_KEYS];
export const DANGEROUS_GLOBALS_LIST = [...DANGEROUS_GLOBALS];
