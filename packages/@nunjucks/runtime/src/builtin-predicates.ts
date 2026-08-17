import { isKeyedObject, isTypedArray } from '@nunjucks/lib';
import { isAbsentLookupResult } from './member-access.ts';
import { isSafeString } from './runtime-contract/safe-string.ts';

type TestFn = (target: unknown, ...args: unknown[]) => boolean;

// WHY: cap template-supplied regex pattern length — long patterns can trigger catastrophic
// backtracking (ReDoS) once compiled, so overly long patterns are rejected outright.
const MAX_MATCHES_PATTERN_LENGTH = 256;

// WHY: a bounded pattern can still backtrack pathologically against an unbounded subject
// (e.g. `(a+)+$` on a long non-matching string) — oversized subjects are rejected the same
// way oversized patterns are, instead of stalling the render loop.
const MAX_MATCHES_TARGET_LENGTH = 10_000;

const matchesPattern = (target: string, pattern: unknown): boolean => {
  if (target.length > MAX_MATCHES_TARGET_LENGTH) {
    return false;
  }
  if (pattern instanceof RegExp) {
    return pattern.test(target);
  }
  const source = String(pattern);
  if (source.length > MAX_MATCHES_PATTERN_LENGTH) {
    return false;
  }
  return new RegExp(source).test(target);
};

/**
 * Frozen registry of every built-in test predicate keyed by name. Entries are
 * pure synchronous checks that treat miss sentinels as absent values; names
 * that miss this registry fall through to the env's `getTest` hook.
 */
const BUILTIN_TESTS: Readonly<Record<string, TestFn>> = {
  // WHY: miss sentinels are objects, so raw comparisons would misreport them —
  // `obj.missing is defined` must be false and `is undefined/null/none` true.
  defined: (target) => target !== undefined && !isAbsentLookupResult(target),
  undefined: (target) => target === undefined || isAbsentLookupResult(target),
  null: (target) => target === null,
  none: (target) => target === null || target === undefined || isAbsentLookupResult(target),
  truthy: (target) => !isAbsentLookupResult(target) && Boolean(target),
  falsy: (target) => isAbsentLookupResult(target) || !target,
  true: (target) => target === true,
  false: (target) => target === false,
  boolean: (target) => target === true || target === false,
  number: (target) => typeof target === 'number' && !Number.isNaN(target),
  integer: (target) => Number.isInteger(target),
  float: (target) => typeof target === 'number' && !Number.isInteger(target),
  odd: (target) => typeof target === 'number' && target % 2 !== 0,
  even: (target) => typeof target === 'number' && target % 2 === 0,
  positive: (target) => typeof target === 'number' && target > 0,
  negative: (target) => typeof target === 'number' && target < 0,
  zero: (target) => target === 0,
  finite: (target) => Number.isFinite(target),
  nan: (target) => Number.isNaN(target),
  divisibleby: (target, divisor) =>
    typeof target === 'number' &&
    !Number.isNaN(target) &&
    typeof divisor === 'number' &&
    target % divisor === 0,
  between: (target, low, high) => Number(target) >= Number(low) && Number(target) <= Number(high),
  string: (target) => typeof target === 'string',
  lower: (target) => typeof target === 'string' && target === target.toLowerCase(),
  upper: (target) => typeof target === 'string' && target === target.toUpperCase(),
  alpha: (target) => typeof target === 'string' && /^[a-zA-Z]+$/.test(target),
  alphanumeric: (target) => typeof target === 'string' && /^[a-zA-Z0-9]+$/.test(target),
  numeric: (target) => typeof target === 'string' && /^[0-9]+$/.test(target),
  startswith: (target, prefix) =>
    typeof target === 'string' && typeof prefix === 'string' && target.startsWith(prefix),
  endswith: (target, suffix) =>
    typeof target === 'string' && typeof suffix === 'string' && target.endsWith(suffix),
  matches: (target, pattern) => typeof target === 'string' && matchesPattern(target, pattern),
  empty: (target) =>
    target === '' ||
    target === null ||
    target === undefined ||
    (typeof target === 'object' && target !== null && 'length' in target && target.length === 0),
  blank: (target) =>
    typeof target === 'string'
      ? target.trim() === ''
      : target === '' ||
        target === null ||
        target === undefined ||
        (typeof target === 'object' && 'length' in target && target.length === 0),
  contains: (target, item) => {
    if (target == null) {
      return false;
    }
    if (typeof target === 'string') {
      return target.includes(typeof item === 'string' ? item : String(item));
    }
    if (Array.isArray(target)) {
      return target.includes(item);
    }
    if (target instanceof Set) {
      return target.has(item);
    }
    return false;
  },
  array: (target) => Array.isArray(target),
  object: (target) => target !== null && typeof target === 'object',
  iterable: (target) => isKeyedObject(target) && Symbol.iterator in target,
  asynciterable: (target) => isKeyedObject(target) && Symbol.asyncIterator in target,
  typedarray: (target) => isTypedArray(target),
  buffer: (target) => typeof Buffer !== 'undefined' && target instanceof Buffer,
  bigint: (target) => typeof target === 'bigint',
  symbol: (target) => typeof target === 'symbol',
  function: (target) => typeof target === 'function',
  // WHY: constructor?.name — null-prototype callables (miss sentinels) have no .constructor.
  asyncfunction: (target) =>
    typeof target === 'function' && target.constructor?.name === 'AsyncFunction',
  Map: (target) => target instanceof Map,
  Set: (target) => target instanceof Set,
  Date: (target) => target instanceof Date,
  RegExp: (target) => target instanceof RegExp,
  Error: (target) => target instanceof Error,
  URL: (target) => typeof URL !== 'undefined' && target instanceof URL,
  Promise: (target) => target instanceof Promise,
  sameas: (target, other) => target === other,
  equalto: (target, other) => JSON.stringify(target) === JSON.stringify(other),
  has: (target, key) => isKeyedObject(target) && String(key) in target,
  hasown: (target, key) => isKeyedObject(target) && Object.hasOwn(target, String(key)),
  safe: (target) => isSafeString(target),
  escaped: (target) => !isSafeString(target),
};

/**
 * Runs a test predicate by name — built-ins first, then the environment's
 * `getTest` hook — returning `false` for unknown names rather than throwing,
 * so generated code stays branch-free.
 */
const runTest = (env: unknown, name: string, target: unknown, ...args: unknown[]): boolean => {
  const builtin = BUILTIN_TESTS[name];
  if (builtin) {
    return builtin(target, ...args);
  }
  // WHY: env arrives as unknown from compiler-emitted call sites (the env object is contextually
  // opaque to generated code); only the optional getTest member is consulted, so a structural
  // narrowing cast is sound.
  const envObj = env as { getTest?: (name: string) => TestFn | undefined } | null;
  const custom = envObj?.getTest?.(name);
  if (typeof custom === 'function') {
    return custom(target, ...args);
  }
  return false;
};

// WHY: module-level export for the co-located drift-pin test only — the registry is
// not part of the package's public surface (tests import the module directly).
const collectBuiltinTestNames = (): readonly string[] => Object.keys(BUILTIN_TESTS).toSorted();

export { runTest, collectBuiltinTestNames };
