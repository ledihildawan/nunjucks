type BlockedKeyCategory =
  | 'object_intrinsic'
  | 'universal_global'
  | 'node_global'
  | 'browser_global'
  | 'deno_global'
  | null;

const toSet = (...lists: readonly (readonly string[] | Set<string>)[]): Set<string> =>
  new Set<string>(lists.flatMap((list) => [...list]));

const BLOCKED_KEY_CATEGORIES = Object.freeze({
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

const BASE_BLOCKED_KEYS = toSet(
  BLOCKED_KEY_CATEGORIES.OBJECT_INTRINSICS,
  BLOCKED_KEY_CATEGORIES.UNIVERSAL_GLOBALS
);

const NODE_BLOCKED_KEYS = toSet(BASE_BLOCKED_KEYS, BLOCKED_KEY_CATEGORIES.NODE_GLOBALS);
const BROWSER_BLOCKED_KEYS = toSet(BASE_BLOCKED_KEYS, BLOCKED_KEY_CATEGORIES.BROWSER_GLOBALS);
const DENO_BLOCKED_KEYS = toSet(BASE_BLOCKED_KEYS, BLOCKED_KEY_CATEGORIES.DENO_GLOBALS);
const AUTO_BLOCKED_KEYS = toSet(
  BASE_BLOCKED_KEYS,
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

const CODE_EXECUTION_PATTERNS = toSet(BLOCKED_KEY_CATEGORIES.CODE_EXECUTION);

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

/** Checks whether a name matches a known code-execution sink such as `eval` or `exec`. */
export const isCodeExecutionPattern = (key: string): boolean => CODE_EXECUTION_PATTERNS.has(key);

const checkEnvGlobals = (key: string, env: Environment): BlockedKeyCategory | null => {
  if ((env === 'auto' || env === 'node') && BLOCKED_KEY_CATEGORIES.NODE_GLOBALS.includes(key)) {
    return 'node_global';
  }
  if (
    (env === 'auto' || env === 'browser') &&
    BLOCKED_KEY_CATEGORIES.BROWSER_GLOBALS.includes(key)
  ) {
    return 'browser_global';
  }
  if ((env === 'auto' || env === 'deno') && BLOCKED_KEY_CATEGORIES.DENO_GLOBALS.includes(key)) {
    return 'deno_global';
  }
  return null;
};

/**
 * Classifies a key by blocklist category — `'auto'` widens the environment-specific tiers,
 * and a miss on every tier returns `null` (not blocked) rather than defaulting to intrinsic.
 */
export const getBlockedKeyCategory = (
  key: string,
  env: Environment = 'auto'
): BlockedKeyCategory => {
  if (BLOCKED_KEY_CATEGORIES.OBJECT_INTRINSICS.includes(key)) {
    return 'object_intrinsic';
  }
  if (BLOCKED_KEY_CATEGORIES.UNIVERSAL_GLOBALS.includes(key)) {
    return 'universal_global';
  }
  return checkEnvGlobals(key, env);
};

/**
 * Reports whether `key` is blocked for `env`: every environment inherits the base union of
 * object intrinsics and universal globals, while `'auto'` takes the union of all three tiers.
 */
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

/** Checks membership in the environment-globals union, excluding object intrinsics. */
export const isDangerousGlobal = (key: string): boolean => DANGEROUS_GLOBALS.has(key);

// WHY: the minimal inherited-key set that yields code execution (`x.constructor.constructor`
// reaches Function). Blocked for INHERITED reads unconditionally (sandbox or not) because
// RCE must not depend on the host remembering to enable the sandbox; own properties are the
// host's explicit choice and remain allowed. Deliberately narrower than OBJECT_INTRINSICS —
// harmless inherited members (toString/valueOf) keep working.
const PROTOTYPE_ESCAPE_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * Reports whether reading `key` as an inherited property escapes the prototype chain to
 * code execution — blocked unconditionally, independent of any sandbox configuration.
 */
const isPrototypeEscapeKey = (key: string): boolean => PROTOTYPE_ESCAPE_KEYS.has(key);

/**
 * Lists every key blocked under `'auto'` (base plus all three environment tiers) as a
 * plain array snapshot — set order is unspecified, so consumers must not rely on it.
 */
export const BLOCKED_KEYS_LIST: readonly string[] = [...AUTO_BLOCKED_KEYS];
/** Lists the environment-global names (universal, Node, browser, Deno) as an array snapshot. */
export const DANGEROUS_GLOBALS_LIST: readonly string[] = [...DANGEROUS_GLOBALS];
export { isPrototypeEscapeKey };

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
