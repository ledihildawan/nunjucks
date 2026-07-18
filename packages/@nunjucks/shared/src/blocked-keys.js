export const ENVIRONMENTS = {
  NODE: 'node',
  BROWSER: 'browser',
  DENO: 'deno',
};

export const BLOCKED_KEY_CATEGORIES = Object.freeze({
  OBJECT_INTRINSICS: [
    '__proto__',
    'constructor',
    'prototype',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toString',
    'toLocaleString',
    'valueOf',
  ],
  UNIVERSAL_GLOBALS: [
    'globalThis',
    'eval',
    'Function',
    'AsyncFunction',
    'GeneratorFunction',
    'AsyncGeneratorFunction',
    'Reflect',
    'Proxy',
    'WebAssembly',
  ],
  NODE_GLOBALS: [
    'global',
    'process',
    'require',
    'module',
    'exports',
    '__dirname',
    '__filename',
    'Buffer',
  ],
  BROWSER_GLOBALS: [
    'window',
    'self',
    'document',
    'location',
    'history',
    'navigator',
    'frames',
    'parent',
    'top',
    'opener',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'EventSource',
    'Worker',
    'SharedWorker',
    'ServiceWorker',
    'importScripts',
  ],
  DENO_GLOBALS: [
    'Deno',
    'process',
  ],
  CODE_EXECUTION: [
    'eval',
    'Function',
    'AsyncFunction',
    'GeneratorFunction',
    'AsyncGeneratorFunction',
    'setTimeout',
    'setInterval',
    'setImmediate',
    'requestAnimationFrame',
    'queueMicrotask',
    'exec',
    'execFile',
    'execSync',
    'spawn',
    'spawnSync',
    'fork',
    'import',
    'importScripts',
    'fetch',
    'XMLHttpRequest',
    'WebSocket',
    'Worker',
    'SharedWorker',
    'WebAssembly',
  ],
});

const toSet = (...lists) => new Set(lists.flatMap((list) => [...list]));

const BASE_BLOCKED_KEYS = toSet(
  BLOCKED_KEY_CATEGORIES.OBJECT_INTRINSICS,
  BLOCKED_KEY_CATEGORIES.UNIVERSAL_GLOBALS,
);

const NODE_BLOCKED_KEYS = toSet(BASE_BLOCKED_KEYS, BLOCKED_KEY_CATEGORIES.NODE_GLOBALS);
const BROWSER_BLOCKED_KEYS = toSet(BASE_BLOCKED_KEYS, BLOCKED_KEY_CATEGORIES.BROWSER_GLOBALS);
const DENO_BLOCKED_KEYS = toSet(BASE_BLOCKED_KEYS, BLOCKED_KEY_CATEGORIES.DENO_GLOBALS);
const AUTO_BLOCKED_KEYS = toSet(
  BASE_BLOCKED_KEYS,
  BLOCKED_KEY_CATEGORIES.NODE_GLOBALS,
  BLOCKED_KEY_CATEGORIES.BROWSER_GLOBALS,
  BLOCKED_KEY_CATEGORIES.DENO_GLOBALS,
);

const DANGEROUS_GLOBALS = toSet(
  BLOCKED_KEY_CATEGORIES.UNIVERSAL_GLOBALS,
  BLOCKED_KEY_CATEGORIES.NODE_GLOBALS,
  BLOCKED_KEY_CATEGORIES.BROWSER_GLOBALS,
  BLOCKED_KEY_CATEGORIES.DENO_GLOBALS,
);

const CODE_EXECUTION_PATTERNS = toSet(BLOCKED_KEY_CATEGORIES.CODE_EXECUTION);

export const isCodeExecutionPattern = (key) => CODE_EXECUTION_PATTERNS.has(key);

export const getBlockedKeyCategory = (key, env = 'auto') => {
  if (BLOCKED_KEY_CATEGORIES.OBJECT_INTRINSICS.includes(key)) return 'object_intrinsic';
  if (BLOCKED_KEY_CATEGORIES.UNIVERSAL_GLOBALS.includes(key)) return 'universal_global';
  if ((env === 'auto' || env === 'node') && BLOCKED_KEY_CATEGORIES.NODE_GLOBALS.includes(key)) return 'node_global';
  if ((env === 'auto' || env === 'browser') && BLOCKED_KEY_CATEGORIES.BROWSER_GLOBALS.includes(key)) return 'browser_global';
  if ((env === 'auto' || env === 'deno') && BLOCKED_KEY_CATEGORIES.DENO_GLOBALS.includes(key)) return 'deno_global';
  return null;
};

export const isBlockedKey = (key, env = 'auto') => {
  switch (env) {
    case 'auto':
      return AUTO_BLOCKED_KEYS.has(key);
    case 'node':
      return NODE_BLOCKED_KEYS.has(key);
    case 'browser':
      return BROWSER_BLOCKED_KEYS.has(key);
    case 'deno':
      return DENO_BLOCKED_KEYS.has(key);
    default:
      return BASE_BLOCKED_KEYS.has(key);
  }
};

export const isDangerousGlobal = (key) => DANGEROUS_GLOBALS.has(key);

export const BLOCKED_KEYS_LIST = [...AUTO_BLOCKED_KEYS];
export const DANGEROUS_GLOBALS_LIST = [...DANGEROUS_GLOBALS];
