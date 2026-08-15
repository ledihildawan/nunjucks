import { isKeyedObject, isTypedArray } from '@nunjucks/lib';
import { isSafeString } from './runtime-contract/safe-string.ts';

type TestFn = (target: unknown, ...args: unknown[]) => boolean;

const BUILTIN_TESTS: Readonly<Record<string, TestFn>> = {
  defined: (target) => target !== undefined,
  undefined: (target) => target === undefined,
  null: (target) => target === null,
  none: (target) => target === null || target === undefined,
  truthy: (target) => Boolean(target),
  falsy: (target) => !target,
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
  matches: (target, pattern) =>
    typeof target === 'string' &&
    (pattern instanceof RegExp ? pattern.test(target) : new RegExp(String(pattern)).test(target)),
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
  asyncfunction: (target) =>
    typeof target === 'function' && target.constructor.name === 'AsyncFunction',
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
  hasown: (target, key) => Object.hasOwn(target as object, String(key)),
  safe: (target) => isSafeString(target),
  escaped: (target) => !isSafeString(target),
};

const runTest = <T = unknown>(
  env: unknown,
  name: string,
  target: T,
  ...args: unknown[]
): boolean => {
  const builtin = BUILTIN_TESTS[name];
  if (builtin) {
    return builtin(target, ...args);
  }
  const envObj = env as { getTest?: (name: string) => TestFn | undefined } | null;
  const custom = envObj?.getTest?.(name);
  if (typeof custom === 'function') {
    return custom(target, ...args);
  }
  return false;
};

export { runTest };
