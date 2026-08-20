/**
 * Frozen category lists — the single source of truth for the sandbox security tiers.
 * The policy PREDICATES that consume them live in `@nunjucks/security` so both runtime
 * and validators can derive from one source without inverting the package DAG, while
 * this module stays a pure constants tier (types, constants, snapshots — no logic).
 */
// WHY: deep freeze — freezing only the outer object left the inner arrays mutable,
// so the "frozen" claim above was not actually enforced.
const deepFreezeCategories = <T extends Record<string, readonly string[]>>(
  categories: T
): Readonly<T> => {
  for (const list of Object.values(categories)) {
    Object.freeze(list);
  }
  return Object.freeze(categories);
};

export const BLOCKED_KEY_CATEGORIES = deepFreezeCategories({
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
  ] as readonly string[],
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
  ] as readonly string[],
  NODE_GLOBALS: [
    'global',
    'process',
    'require',
    'module',
    'exports',
    '__dirname',
    '__filename',
    'Buffer',
  ] as readonly string[],
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
  ] as readonly string[],
  DENO_GLOBALS: ['Deno', 'process'] as readonly string[],
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
    'execScript',
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
  ] as readonly string[],
});
const toSet = (...lists: readonly (readonly string[] | Set<string>)[]): Set<string> =>
  new Set<string>(lists.flatMap((list) => [...list]));

const AUTO_BLOCKED_KEYS = toSet(
  BLOCKED_KEY_CATEGORIES.OBJECT_INTRINSICS,
  BLOCKED_KEY_CATEGORIES.UNIVERSAL_GLOBALS,
  BLOCKED_KEY_CATEGORIES.NODE_GLOBALS,
  BLOCKED_KEY_CATEGORIES.BROWSER_GLOBALS,
  BLOCKED_KEY_CATEGORIES.DENO_GLOBALS
);

const DANGEROUS_GLOBALS = toSet(
  BLOCKED_KEY_CATEGORIES.UNIVERSAL_GLOBALS,
  BLOCKED_KEY_CATEGORIES.NODE_GLOBALS,
  BLOCKED_KEY_CATEGORIES.BROWSER_GLOBALS,
  BLOCKED_KEY_CATEGORIES.DENO_GLOBALS
);

/**
 * Freezes the named sandbox environment identifiers — `ENVIRONMENT_VALUES` derives its
 * members from this map, so adding an environment here is the single edit required.
 */
export const ENVIRONMENTS = {
  NODE: 'node',
  BROWSER: 'browser',
  DENO: 'deno',
} as const;

// WHY: single source of truth for the config-facing environment union — validators derive
// their membership set from this tuple instead of re-listing the members.
export const ENVIRONMENT_VALUES = ['auto', ...Object.values(ENVIRONMENTS)] as const;

/**
 * Narrows a config string to `'auto' | 'node' | 'browser' | 'deno'` — all members flow
 * from `ENVIRONMENTS`.
 */
export type Environment = (typeof ENVIRONMENT_VALUES)[number];

/**
 * Lists every key blocked under `'auto'` (base plus all three environment tiers) as a
 * plain array snapshot — set order is unspecified, so consumers must not rely on it.
 */
export const BLOCKED_KEYS_LIST: readonly string[] = [...AUTO_BLOCKED_KEYS];
/** Lists the environment-global names (universal, Node, browser, Deno) as an array snapshot. */
export const DANGEROUS_GLOBALS_LIST: readonly string[] = [...DANGEROUS_GLOBALS];

/** Lists the frozen object-intrinsic names (`__proto__`, `constructor`, `prototype`, …). */
export const OBJECT_INTRINSICS: readonly string[] = [...BLOCKED_KEY_CATEGORIES.OBJECT_INTRINSICS];
/**
 * Lists the code-execution sink names — overlapping the global tiers by design, since the
 * same name (`eval`, `Function`) is both a reachable global and a direct execution vector.
 */
export const CODE_EXECUTION_KEYS: readonly string[] = [...BLOCKED_KEY_CATEGORIES.CODE_EXECUTION];

/**
 * Matches the cross-realm reachability globals (`globalThis`, `process`, window-tree
 * aliases) case-insensitively — narrower than `DANGEROUS_GLOBALS_LIST` by intent.
 */
export const DANGEROUS_KEY_PATTERN = /^(?:globalThis|process|window|parent|top|frames|opener)$/iu;
