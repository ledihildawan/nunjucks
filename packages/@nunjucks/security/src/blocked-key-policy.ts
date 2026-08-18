// WHY: blocked-key PREDICATES live in the security kernel (not shared) because they are
// domain policy logic, while the underlying tier lists stay in shared as pure constants.
// Both runtime (sandbox, frame guards) and validators (context scanning) depend on this
// module — runtime cannot import validators (DAG: validators sits above runtime).
import { BLOCKED_KEY_CATEGORIES, type Environment } from '@nunjucks/shared';

type BlockedKeyCategory =
  | 'object_intrinsic'
  | 'universal_global'
  | 'node_global'
  | 'browser_global'
  | 'deno_global'
  | null;

export type { BlockedKeyCategory };

const toSet = (...lists: readonly (readonly string[] | Set<string>)[]): Set<string> =>
  new Set<string>(lists.flatMap((list) => [...list]));

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

/** Checks whether a name matches a known code-execution sink such as `eval` or `exec`. */
export const isCodeExecutionPattern = (key: string): boolean => CODE_EXECUTION_PATTERNS.has(key);

// WHY: precomputed Sets replace O(n) array.includes() scans on the hot-path sandbox classification.
const OBJECT_INTRINSICS_SET = new Set(BLOCKED_KEY_CATEGORIES.OBJECT_INTRINSICS);
const UNIVERSAL_GLOBALS_SET = new Set(BLOCKED_KEY_CATEGORIES.UNIVERSAL_GLOBALS);
const NODE_GLOBALS_SET = new Set(BLOCKED_KEY_CATEGORIES.NODE_GLOBALS);
const BROWSER_GLOBALS_SET = new Set(BLOCKED_KEY_CATEGORIES.BROWSER_GLOBALS);
const DENO_GLOBALS_SET = new Set(BLOCKED_KEY_CATEGORIES.DENO_GLOBALS);

const checkEnvGlobals = (key: string, env: Environment): BlockedKeyCategory | null => {
  if ((env === 'auto' || env === 'node') && NODE_GLOBALS_SET.has(key)) {
    return 'node_global';
  }
  if ((env === 'auto' || env === 'browser') && BROWSER_GLOBALS_SET.has(key)) {
    return 'browser_global';
  }
  if ((env === 'auto' || env === 'deno') && DENO_GLOBALS_SET.has(key)) {
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
  if (OBJECT_INTRINSICS_SET.has(key)) {
    return 'object_intrinsic';
  }
  if (UNIVERSAL_GLOBALS_SET.has(key)) {
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
export const isPrototypeEscapeKey = (key: string): boolean => PROTOTYPE_ESCAPE_KEYS.has(key);
