export const ENVIRONMENTS = {
  NODE: 'node',
  BROWSER: 'browser',
  DENO: 'deno',
} as const;

export type Environment = 'auto' | 'node' | 'browser' | 'deno';

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
  ] as const,
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
  ] as const,
  NODE_GLOBALS: [
    'global',
    'process',
    'require',
    'module',
    'exports',
    '__dirname',
    '__filename',
    'Buffer',
  ] as const,
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
  ] as const,
  DENO_GLOBALS: [
    'Deno',
    'process',
  ] as const,
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
  ] as const,
});

type BlockedKeyCategory = 'object_intrinsic' | 'universal_global' | 'node_global' | 'browser_global' | 'deno_global' | null;

const toSet = (...lists: readonly (readonly string[] | Set<string>)[]): Set<string> =>
  new Set<string>(lists.flatMap((list) => list instanceof Set ? [...list] : list));

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

export const isCodeExecutionPattern = (key: string): boolean => CODE_EXECUTION_PATTERNS.has(key);

const hasKey = (arr: readonly string[], key: string): boolean => arr.includes(key);

export const getBlockedKeyCategory = (key: string, env: Environment = 'auto'): BlockedKeyCategory => {
  if (hasKey(BLOCKED_KEY_CATEGORIES.OBJECT_INTRINSICS, key)) return 'object_intrinsic';
  if (hasKey(BLOCKED_KEY_CATEGORIES.UNIVERSAL_GLOBALS, key)) return 'universal_global';
  if ((env === 'auto' || env === 'node') && hasKey(BLOCKED_KEY_CATEGORIES.NODE_GLOBALS, key)) return 'node_global';
  if ((env === 'auto' || env === 'browser') && hasKey(BLOCKED_KEY_CATEGORIES.BROWSER_GLOBALS, key)) return 'browser_global';
  if ((env === 'auto' || env === 'deno') && hasKey(BLOCKED_KEY_CATEGORIES.DENO_GLOBALS, key)) return 'deno_global';
  return null;
};

export const isBlockedKey = (key: string, env: Environment = 'auto'): boolean => {
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

export const isDangerousGlobal = (key: string): boolean => DANGEROUS_GLOBALS.has(key);

export const BLOCKED_KEYS_LIST: readonly string[] = [...AUTO_BLOCKED_KEYS];
export const DANGEROUS_GLOBALS_LIST: readonly string[] = [...DANGEROUS_GLOBALS];