// Compiler emits `runtime.runTest(env, "name", target, ...args)` uniformly;
// this map provides the implementation. Built-in tests take precedence over
// user-registered ones (a `name` that matches a built-in is never delegated
// to `env.getTest`), so core tests like `defined`/`odd` cannot be shadowed.

const isTypedArray = (val: unknown): boolean =>
  val instanceof Int8Array || val instanceof Uint8Array || val instanceof Uint8ClampedArray ||
  val instanceof Int16Array || val instanceof Uint16Array || val instanceof Int32Array ||
  val instanceof Uint32Array || val instanceof Float32Array || val instanceof Float64Array ||
  val instanceof BigInt64Array || val instanceof BigUint64Array;

import { isSafeString } from './safe-string.ts';
import { isKeyedObject } from '@nunjucks/shared';

type TestFn = (target: unknown, ...args: unknown[]) => boolean;

const BUILTIN_TESTS: Readonly<Record<string, TestFn>> = {
  defined: (t) => t !== undefined,
  undefined: (t) => t === undefined,
  null: (t) => t === null,
  none: (t) => t === null || t === undefined,
  truthy: (t) => Boolean(t),
  falsy: (t) => !t,
  true: (t) => t === true,
  false: (t) => t === false,
  boolean: (t) => t === true || t === false,
  number: (t) => typeof t === 'number' && !Number.isNaN(t),
  integer: (t) => Number.isInteger(t),
  float: (t) => typeof t === 'number' && !Number.isInteger(t),
  odd: (t) => typeof t === 'number' && t % 2 !== 0,
  even: (t) => typeof t === 'number' && t % 2 === 0,
  positive: (t) => typeof t === 'number' && t > 0,
  negative: (t) => typeof t === 'number' && t < 0,
  zero: (t) => t === 0,
  finite: (t) => Number.isFinite(t),
  nan: (t) => Number.isNaN(t),
  divisibleby: (t, d) => typeof t === 'number' && !Number.isNaN(t) && typeof d === 'number' && t % d === 0,
  between: (t, lo, hi) => Number(t) >= Number(lo) && Number(t) <= Number(hi),
  string: (t) => typeof t === 'string',
  lower: (t) => typeof t === 'string' && t === t.toLowerCase(),
  upper: (t) => typeof t === 'string' && t === t.toUpperCase(),
  alpha: (t) => typeof t === 'string' && /^[a-zA-Z]+$/.test(t),
  alphanumeric: (t) => typeof t === 'string' && /^[a-zA-Z0-9]+$/.test(t),
  numeric: (t) => typeof t === 'string' && /^[0-9]+$/.test(t),
  startswith: (t, prefix) => typeof t === 'string' && typeof prefix === 'string' && t.startsWith(prefix),
  endswith: (t, suffix) => typeof t === 'string' && typeof suffix === 'string' && t.endsWith(suffix),
  matches: (t, pattern) => typeof t === 'string' && (pattern instanceof RegExp ? pattern.test(t) : new RegExp(String(pattern)).test(t)),
  empty: (t) => t === '' || t === null || t === undefined || (typeof t === 'object' && t !== null && 'length' in t && t.length === 0),
  blank: (t) => typeof t === 'string' ? t.trim() === '' : (t === '' || t === null || t === undefined || (typeof t === 'object' && 'length' in t && t.length === 0)),
  contains: (t, item) => {
    if (t == null) { return false; }
    if (typeof t === 'string' || Array.isArray(t)) { return t.includes(item as never); }
    if (t instanceof Set) { return t.has(item); }
    return false;
  },
  array: (t) => Array.isArray(t),
  object: (t) => t !== null && typeof t === 'object',
  iterable: (t) => isKeyedObject(t) && Symbol.iterator in t,
  asynciterable: (t) => isKeyedObject(t) && Symbol.asyncIterator in t,
  typedarray: (t) => isTypedArray(t),
  buffer: (t) => typeof Buffer !== 'undefined' && t instanceof Buffer,
  bigint: (t) => typeof t === 'bigint',
  symbol: (t) => typeof t === 'symbol',
  function: (t) => typeof t === 'function',
  asyncfunction: (t) => typeof t === 'function' && t.constructor.name === 'AsyncFunction',
  Map: (t) => t instanceof Map,
  Set: (t) => t instanceof Set,
  Date: (t) => t instanceof Date,
  RegExp: (t) => t instanceof RegExp,
  Error: (t) => t instanceof Error,
  URL: (t) => typeof URL !== 'undefined' && t instanceof URL,
  Promise: (t) => t instanceof Promise,
  sameas: (t, other) => t === other,
  equalto: (t, other) => JSON.stringify(t) === JSON.stringify(other),
  has: (t, key) => isKeyedObject(t) && String(key) in t,
  hasown: (t, key) => Object.hasOwn(t as object, String(key)),
  safe: (t) => isSafeString(t),
  escaped: (t) => !isSafeString(t),
};

const runTest = (
  env: unknown,
  name: string,
  target: unknown,
  ...args: unknown[]
): boolean => {
  const builtin = BUILTIN_TESTS[name];
  if (builtin) { return builtin(target, ...args); }
  const envObj = env as { getTest?: (name: string) => ((target: unknown, ...args: unknown[]) => boolean) | undefined } | null;
  const custom = envObj?.getTest?.(name);
  if (typeof custom === 'function') { return custom(target, ...args); }
  return false;
};

export { runTest };
